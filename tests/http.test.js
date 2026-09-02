"use strict";

const assert = require("assert");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createApp = require(path.resolve(process.cwd(), "server", "app.js"));

async function withCodexCommand(fixtureName, callback) {
    const previousCommand = process.env.CODEX_COMMAND;
    const previousTimeout = process.env.CODEX_TIMEOUT_MS;

    process.env.CODEX_COMMAND = path.resolve(process.cwd(), "tests", "fixtures", fixtureName);
    process.env.CODEX_TIMEOUT_MS = "2000";

    try {
        return await callback();
    } finally {
        if (previousCommand === undefined) {
            delete process.env.CODEX_COMMAND;
        } else {
            process.env.CODEX_COMMAND = previousCommand;
        }

        if (previousTimeout === undefined) {
            delete process.env.CODEX_TIMEOUT_MS;
        } else {
            process.env.CODEX_TIMEOUT_MS = previousTimeout;
        }
    }
}

test("the HTTP shell exposes health and Codex status", async function () {
    await withCodexCommand("fakeCodex.js", async function () {
        const app = createApp();

        try {
            const healthResponse = await app.inject({method: "GET", url: "/health"});
            assert.equal(healthResponse.statusCode, 200);
            assert.deepEqual(healthResponse.json(), {status: "ok"});

            const statusResponse = await app.inject({method: "GET", url: "/api/providers/codex"});
            assert.equal(statusResponse.statusCode, 200);
            assert.equal(statusResponse.json().authenticated, true);
        } finally {
            await app.close();
        }
    });
});

test("the smoke endpoint requires exact confirmation", async function () {
    await withCodexCommand("fakeCodex.js", async function () {
        const app = createApp();

        try {
            const missingResponse = await app.inject({
                method: "POST",
                payload: {},
                url: "/api/providers/codex/smoke"
            });
            assert.equal(missingResponse.statusCode, 400);
            assert.equal(missingResponse.json().code, "INVALID_REQUEST");

            const extraResponse = await app.inject({
                method: "POST",
                payload: {confirmed: true, prompt: "not allowed"},
                url: "/api/providers/codex/smoke"
            });
            assert.equal(extraResponse.statusCode, 400);
        } finally {
            await app.close();
        }
    });
});

test("the smoke endpoint returns only normalized output", async function () {
    await withCodexCommand("fakeCodex.js", async function () {
        const app = createApp();

        try {
            const response = await app.inject({
                method: "POST",
                payload: {confirmed: true},
                url: "/api/providers/codex/smoke"
            });
            const body = response.json();

            assert.equal(response.statusCode, 200);
            assert.equal(body.status, "ok");
            assert.equal(body.message, "Secrets are isolated.");
            assert.deepEqual(Object.keys(body).sort(), ["durationMs", "message", "provider", "status"]);
        } finally {
            await app.close();
        }
    });
});

test("the HTTP boundary redacts malformed provider output", async function () {
    await withCodexCommand("fakeCodexMalformed.js", async function () {
        const app = createApp();

        try {
            const response = await app.inject({
                method: "POST",
                payload: {confirmed: true},
                url: "/api/providers/codex/smoke"
            });
            const body = response.json();

            assert.equal(response.statusCode, 502);
            assert.equal(body.code, "CODEX_PROTOCOL_ERROR");
            assert.equal(response.body.includes("private malformed output"), false);
        } finally {
            await app.close();
        }
    });
});

