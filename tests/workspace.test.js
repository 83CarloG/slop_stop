"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const workspace = require(path.resolve(process.cwd(), "src", "drivers", "workspace.js"));

test("a disposable Git snapshot produces an integrity-checked patch without changing the source", async function () {
    const previousStorePath = process.env.EVENT_STORE_PATH;
    const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-workspace-test-"));
    const sourceStatusBefore = childProcess.execFileSync("git", ["status", "--short"], {
        cwd: process.cwd(),
        encoding: "utf8"
    });
    const executionId = crypto.randomUUID();
    let snapshot = null;

    process.env.EVENT_STORE_PATH = path.resolve(artifactRoot, "events.jsonl");

    try {
        snapshot = await workspace({action: "createSnapshot"});

        assert.match(snapshot.sourceRevision, /^[0-9a-f]{40,64}$/u);
        assert.equal(fs.existsSync(path.resolve(snapshot.workspacePath, ".data")), false);
        assert.equal(fs.existsSync(path.resolve(snapshot.workspacePath, "docs")), false);

        fs.writeFileSync(path.resolve(snapshot.workspacePath, "m5bCandidate.txt"), "isolated candidate\n", "utf8");
        const captured = await workspace({action: "captureChanges", workspacePath: snapshot.workspacePath});

        assert.deepEqual(captured.changedFiles, ["m5bCandidate.txt"]);
        assert.match(captured.patch, /isolated candidate/u);

        const stored = await workspace({action: "storePatch", executionId, patch: captured.patch});

        assert.equal(stored.artifact, `executions/${executionId}.patch`);
        assert.equal(await workspace({
            action: "readPatch",
            executionId,
            expectedSha256: stored.sha256
        }), captured.patch);

        fs.appendFileSync(path.resolve(artifactRoot, stored.artifact), "tampered\n", "utf8");
        await assert.rejects(workspace({
            action: "readPatch",
            executionId,
            expectedSha256: stored.sha256
        }), function (error) {
            return error.code === "PATCH_CORRUPTED";
        });

        assert.equal(childProcess.execFileSync("git", ["status", "--short"], {
            cwd: process.cwd(),
            encoding: "utf8"
        }), sourceStatusBefore);
    } finally {
        if (snapshot) {
            await workspace({action: "cleanupSnapshot", temporaryDirectory: snapshot.temporaryDirectory});
        }

        if (previousStorePath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousStorePath;
        }

        fs.rmSync(artifactRoot, {force: true, recursive: true});
    }
});
