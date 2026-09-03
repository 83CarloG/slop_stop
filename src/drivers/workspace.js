"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");

const getApplicationConfig = require(path.resolve(process.cwd(), "config", "application.js"));

const maximumPatchBytes = 512 * 1024;
const maximumSnapshotBytes = 10 * 1024 * 1024;
const maximumChangedFiles = 50;

function createWorkspaceError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function createChildEnvironment() {
    const environment = {};

    for (const name of [
        "COMSPEC",
        "ComSpec",
        "LANG",
        "LC_ALL",
        "PATH",
        "PATHEXT",
        "Path",
        "SYSTEMROOT",
        "SystemRoot",
        "TEMP",
        "TMP",
        "TMPDIR",
        "WINDIR"
    ]) {
        if (process.env[name] !== undefined) {
            environment[name] = process.env[name];
        }
    }

    environment.GIT_CONFIG_NOSYSTEM = "1";
    environment.GIT_TERMINAL_PROMPT = "0";
    return environment;
}

function runGit(argumentsList, options = {}) {
    const result = childProcess.spawnSync("git", argumentsList, {
        cwd: options.cwd || process.cwd(),
        encoding: options.encoding === undefined ? "utf8" : options.encoding,
        env: createChildEnvironment(),
        maxBuffer: maximumPatchBytes * 2,
        shell: false,
        windowsHide: true
    });

    if (result.error || result.status !== 0) {
        throw createWorkspaceError("WORKSPACE_GIT_ERROR", "The isolated Git workspace operation failed.");
    }

    return result.stdout;
}

function pathIsSafeRelative(value) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= 260 &&
        /^[A-Za-z0-9._/-]+$/u.test(value) &&
        !path.isAbsolute(value) &&
        value.split("/").every(function (segment) {
            return segment !== "" && segment !== "." && segment !== "..";
        });
}

function measureWorkspace(directory) {
    let totalBytes = 0;

    function visit(currentDirectory) {
        for (const entry of fs.readdirSync(currentDirectory, {withFileTypes: true})) {
            if (entry.name === ".git") {
                continue;
            }

            const target = path.resolve(currentDirectory, entry.name);

            if (entry.isSymbolicLink()) {
                throw createWorkspaceError("WORKSPACE_UNSAFE_RESULT", "The isolated candidate contains a symbolic link.");
            }

            if (entry.isDirectory()) {
                visit(target);
            } else if (entry.isFile()) {
                totalBytes += fs.statSync(target).size;

                if (totalBytes > maximumSnapshotBytes) {
                    throw createWorkspaceError("WORKSPACE_OUTPUT_LIMIT", "The isolated candidate exceeded the allowed size.");
                }
            }
        }
    }

    visit(directory);
    return totalBytes;
}

function createSnapshot() {
    const sourcePath = path.resolve(process.cwd());
    const repositoryRoot = path.resolve(runGit(["-C", sourcePath, "rev-parse", "--show-toplevel"]).trim());

    if (repositoryRoot !== sourcePath) {
        throw createWorkspaceError("WORKSPACE_SOURCE_INVALID", "The application root must be the Git repository root.");
    }

    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-execution-"));
    const workspacePath = path.resolve(temporaryDirectory, "workspace");

    try {
        runGit(["clone", "--local", "--no-hardlinks", "--no-tags", "--quiet", sourcePath, workspacePath]);
        runGit(["-C", workspacePath, "remote", "remove", "origin"]);
        const sourceRevision = runGit(["-C", workspacePath, "rev-parse", "HEAD"]).trim();
        measureWorkspace(workspacePath);

        return {sourceRevision, temporaryDirectory, workspacePath};
    } catch (error) {
        fs.rmSync(temporaryDirectory, {force: true, recursive: true});
        throw error;
    }
}

function captureChanges(workspacePath) {
    measureWorkspace(workspacePath);
    runGit(["-C", workspacePath, "add", "-A", "--", "."]);
    const namesOutput = runGit([
        "-C",
        workspacePath,
        "diff",
        "--cached",
        "--name-only",
        "-z",
        "--no-renames",
        "HEAD",
        "--"
    ]);
    const changedFiles = namesOutput.split("\0").filter(function (item) {
        return item !== "";
    }).map(function (item) {
        return item.replaceAll("\\", "/");
    });

    if (changedFiles.length === 0) {
        throw createWorkspaceError("WORKSPACE_EMPTY_RESULT", "Codex did not produce a candidate change.");
    }

    if (
        changedFiles.length > maximumChangedFiles ||
        changedFiles.some(function (filePath) {
            return !pathIsSafeRelative(filePath);
        })
    ) {
        throw createWorkspaceError("WORKSPACE_UNSAFE_RESULT", "The isolated candidate contains invalid paths.");
    }

    const patch = runGit([
        "-C",
        workspacePath,
        "diff",
        "--cached",
        "--binary",
        "--no-color",
        "--no-ext-diff",
        "--no-renames",
        "HEAD",
        "--"
    ]);

    if (Buffer.byteLength(patch, "utf8") > maximumPatchBytes) {
        throw createWorkspaceError("WORKSPACE_OUTPUT_LIMIT", "The isolated patch exceeded the allowed size.");
    }

    return {changedFiles, patch};
}

function resolveArtifact(executionId) {
    if (typeof executionId !== "string" || !/^[0-9a-f-]{36}$/u.test(executionId)) {
        throw createWorkspaceError("PATCH_PATH_INVALID", "The patch artifact identifier is invalid.");
    }

    const config = getApplicationConfig();
    const storeDirectory = path.dirname(config.eventStorePath);
    const artifactDirectory = path.resolve(storeDirectory, "executions");
    const artifactPath = path.resolve(artifactDirectory, `${executionId}.patch`);

    if (path.dirname(artifactPath) !== artifactDirectory) {
        throw createWorkspaceError("PATCH_PATH_INVALID", "The patch artifact path is invalid.");
    }

    for (const directory of [storeDirectory, artifactDirectory]) {
        if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
            throw createWorkspaceError("PATCH_PATH_INVALID", "Patch artifacts must not use symbolic directories.");
        }
    }

    return {
        artifact: `executions/${executionId}.patch`,
        artifactDirectory,
        artifactPath
    };
}

function storePatch(executionId, patch) {
    const target = resolveArtifact(executionId);
    const content = Buffer.from(patch, "utf8");

    if (content.length === 0 || content.length > maximumPatchBytes) {
        throw createWorkspaceError("WORKSPACE_OUTPUT_LIMIT", "The patch artifact size is invalid.");
    }

    fs.mkdirSync(target.artifactDirectory, {recursive: true});

    try {
        fs.writeFileSync(target.artifactPath, content, {flag: "wx"});
    } catch (error) {
        if (error.code === "EEXIST") {
            throw createWorkspaceError("PATCH_ALREADY_EXISTS", "The patch artifact already exists.");
        }

        throw error;
    }

    return {
        artifact: target.artifact,
        bytes: content.length,
        sha256: crypto.createHash("sha256").update(content).digest("hex")
    };
}

function readPatch(executionId, expectedSha256) {
    const target = resolveArtifact(executionId);
    let content;

    try {
        content = fs.readFileSync(target.artifactPath);
    } catch (error) {
        throw createWorkspaceError("PATCH_NOT_FOUND", "The patch artifact was not found.");
    }

    const actualSha256 = crypto.createHash("sha256").update(content).digest("hex");

    if (content.length > maximumPatchBytes || actualSha256 !== expectedSha256) {
        throw createWorkspaceError("PATCH_CORRUPTED", "The patch artifact failed its integrity check.");
    }

    return content.toString("utf8");
}

function deletePatch(executionId) {
    const target = resolveArtifact(executionId);
    fs.rmSync(target.artifactPath, {force: true});
}

function cleanupSnapshot(temporaryDirectory) {
    const temporaryRoot = path.resolve(os.tmpdir());
    const resolvedTarget = path.resolve(temporaryDirectory);
    const relativeTarget = path.relative(temporaryRoot, resolvedTarget);

    if (
        relativeTarget.startsWith("..") ||
        path.isAbsolute(relativeTarget) ||
        !path.basename(resolvedTarget).startsWith("slop-stop-execution-")
    ) {
        throw createWorkspaceError("WORKSPACE_CLEANUP_INVALID", "The isolated workspace cleanup path is invalid.");
    }

    fs.rmSync(resolvedTarget, {force: true, recursive: true});
}

module.exports = async function workspace(input) {
    if (!input || input.action === "createSnapshot") {
        return createSnapshot();
    }

    if (input.action === "captureChanges") {
        return captureChanges(input.workspacePath);
    }

    if (input.action === "storePatch") {
        return storePatch(input.executionId, input.patch);
    }

    if (input.action === "readPatch") {
        return readPatch(input.executionId, input.expectedSha256);
    }

    if (input.action === "deletePatch") {
        deletePatch(input.executionId);
        return null;
    }

    if (input.action === "cleanupSnapshot") {
        cleanupSnapshot(input.temporaryDirectory);
        return null;
    }

    throw createWorkspaceError("WORKSPACE_INVALID_ACTION", "The workspace action is invalid.");
};
