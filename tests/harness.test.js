"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const setupHarness = require(path.resolve(process.cwd(), "scripts", "setupHarness.js"));

test("the local harness is create-only and idempotent", function () {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-harness-"));

    try {
        const firstResult = setupHarness(targetRoot);
        assert.equal(firstResult.created.length, 12);
        assert.equal(firstResult.skipped.length, 0);

        const systemPath = path.resolve(targetRoot, "SYSTEM.md");
        fs.writeFileSync(systemPath, "human-owned content\n", "utf8");

        const secondResult = setupHarness(targetRoot);
        assert.equal(secondResult.created.length, 0);
        assert.equal(secondResult.skipped.length, 12);
        assert.equal(fs.readFileSync(systemPath, "utf8"), "human-owned content\n");
    } finally {
        const temporaryRoot = path.resolve(os.tmpdir());
        const resolvedTarget = path.resolve(targetRoot);

        assert.ok(resolvedTarget.startsWith(`${temporaryRoot}${path.sep}`));
        fs.rmSync(resolvedTarget, {recursive: true, force: true});
    }
});

