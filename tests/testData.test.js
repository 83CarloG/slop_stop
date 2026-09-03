"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const manageTestData = require(path.resolve(process.cwd(), "scripts", "manageTestData.js"));

test("test data reset creates one isolated approved and allowed project", async function () {
    const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-test-data-"));
    const primaryStore = path.resolve(targetRoot, ".data", "events.jsonl");
    const testStore = path.resolve(targetRoot, ".data", "test", "events.jsonl");

    try {
        fs.mkdirSync(path.dirname(primaryStore), {recursive: true});
        fs.writeFileSync(primaryStore, "primary data remains untouched\n", "utf8");

        const reset = await manageTestData("reset", targetRoot);

        assert.equal(reset.project.readiness, "allow");
        assert.equal(reset.storePath, testStore);
        assert.equal(fs.readFileSync(primaryStore, "utf8"), "primary data remains untouched\n");
        assert.equal(fs.readFileSync(testStore, "utf8").trim().split("\n").length, 10);

        await assert.rejects(manageTestData("seed", targetRoot), function (error) {
            return error.code === "TEST_DATA_NOT_EMPTY";
        });

        const cleaned = await manageTestData("clean", targetRoot);

        assert.equal(cleaned.removed, true);
        assert.equal(fs.existsSync(testStore), false);
        assert.equal(fs.readFileSync(primaryStore, "utf8"), "primary data remains untouched\n");
    } finally {
        fs.rmSync(targetRoot, {force: true, recursive: true});
    }
});

test("the test server profile pins its port and isolated store", function () {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    const source = fs.readFileSync(path.resolve(process.cwd(), "scripts", "startTest.js"), "utf8");

    assert.match(packageJson.scripts["start:test"], /--watch scripts\/startTest\.js$/u);
    assert.match(packageJson.scripts["start:test:once"], /scripts\/startTest\.js$/u);
    assert.match(source, /process\.env\.APP_PORT = "3001";/u);
    assert.match(source, /process\.env\.EVENT_STORE_PATH = path\.join\("\.data", "test", "events\.jsonl"\);/u);
});
