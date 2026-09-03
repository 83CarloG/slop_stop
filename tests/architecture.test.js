"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const process = require("process");
const test = require("node:test");

const expectedLayers = ["drivers", "features", "jobs", "operations", "services"];
const allowedDependencies = {
    drivers: [],
    features: ["drivers", "jobs", "operations"],
    jobs: ["drivers"],
    operations: ["jobs"],
    services: ["drivers", "features", "jobs", "operations"]
};
const internalRequirePattern = /require\(path\.resolve\(process\.cwd\(\), "src", "([a-z]+)", "([a-z][A-Za-z0-9]*\.js)"\)\)/gu;

function listJavaScriptFiles(directory) {
    const files = [];

    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const absolutePath = path.resolve(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...listJavaScriptFiles(absolutePath));
        } else if (entry.name.endsWith(".js")) {
            files.push(absolutePath);
        }
    }

    return files;
}

function readSource(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function collectInternalDependencies(source) {
    const dependencies = [];

    for (const match of source.matchAll(internalRequirePattern)) {
        dependencies.push(match[1]);
    }

    const allInternalRoots = source.match(/require\(path\.resolve\(process\.cwd\(\), "src",/gu) || [];
    assert.equal(dependencies.length, allInternalRoots.length, "Every src import must use the canonical static form.");

    return dependencies;
}

function validateLayerDependency(sourceLayer, targetLayer) {
    assert.ok(
        allowedDependencies[sourceLayer].includes(targetLayer),
        `${sourceLayer} must not depend on ${targetLayer}`
    );
}

test("the canonical Luminous directories exist without extra layers", function () {
    const srcRoot = path.resolve(process.cwd(), "src");
    const actualLayers = fs.readdirSync(srcRoot, {withFileTypes: true})
        .filter(function (entry) {
            return entry.isDirectory();
        })
        .map(function (entry) {
            return entry.name;
        })
        .sort();

    assert.deepEqual(actualLayers, expectedLayers);
    assert.equal(fs.readdirSync(srcRoot, {withFileTypes: true}).some(function (entry) {
        return entry.isFile() && entry.name.endsWith(".js");
    }), false);
});

test("all first-party JavaScript uses the agreed syntax contract", function () {
    const roots = ["config", "public", "scripts", "server", "src", "tests"];
    const files = roots.flatMap(function (root) {
        return listJavaScriptFiles(path.resolve(process.cwd(), root));
    });

    for (const filePath of files) {
        const source = readSource(filePath);
        const syntaxCheck = childProcess.spawnSync(process.execPath, ["--check", filePath], {
            encoding: "utf8",
            windowsHide: true
        });

        assert.equal(source.startsWith("\"use strict\";\n"), true, `${filePath} must start with the exact strict header.`);
        assert.equal(source.includes("\r"), false, `${filePath} must use LF line endings.`);
        assert.equal(syntaxCheck.status, 0, `${filePath} must pass node --check.`);
    }
});

test("layer files follow naming, export, import, and dependency rules", function () {
    for (const layer of expectedLayers) {
        const layerRoot = path.resolve(process.cwd(), "src", layer);

        for (const filePath of listJavaScriptFiles(layerRoot)) {
            const fileName = path.basename(filePath);
            const source = readSource(filePath);
            const exportMatches = source.match(/module\.exports\s*=/gu) || [];

            assert.match(fileName, /^[a-z][A-Za-z0-9]*\.js$/u);
            assert.equal(exportMatches.length, 1, `${filePath} must have one module.exports assignment.`);
            assert.equal(/\bexports\./u.test(source), false, `${filePath} must not use named CommonJS exports.`);
            assert.equal(/require\(["']\.\.?[/\\]/u.test(source), false, `${filePath} must not use relative imports.`);

            for (const dependency of collectInternalDependencies(source)) {
                validateLayerDependency(layer, dependency);
            }
        }
    }
});

test("entrypoints access src through services only", function () {
    const roots = ["server", "scripts"];

    for (const root of roots) {
        for (const filePath of listJavaScriptFiles(path.resolve(process.cwd(), root))) {
            const source = readSource(filePath);

            for (const dependency of collectInternalDependencies(source)) {
                assert.equal(dependency, "services", `${filePath} must access src through services only.`);
            }
        }
    }
});

test("Fastify remains outside src", function () {
    for (const layer of expectedLayers) {
        const layerRoot = path.resolve(process.cwd(), "src", layer);

        for (const filePath of listJavaScriptFiles(layerRoot)) {
            const source = readSource(filePath);
            assert.equal(/require\(["'](?:@fastify\/|fastify["'])/u.test(source), false);
            assert.equal(/\brequest\.(?:body|params|query|raw)\b/u.test(source), false);
            assert.equal(/\breply\./u.test(source), false);
        }
    }
});

test("the default local server uses native autoreload", function () {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));

    assert.match(packageJson.scripts.start, /(?:^|\s)--watch(?:\s|$)/u);
    assert.equal(packageJson.scripts.dev, "npm start");
    assert.doesNotMatch(packageJson.scripts["start:once"], /(?:^|\s)--watch(?:\s|$)/u);
});

test("the dependency detector rejects known violations", function () {
    assert.throws(function () {
        validateLayerDependency("jobs", "jobs");
    });
    assert.throws(function () {
        validateLayerDependency("operations", "drivers");
    });
    assert.throws(function () {
        validateLayerDependency("features", "features");
    });
    assert.throws(function () {
        validateLayerDependency("drivers", "services");
    });
});
