"use strict";

const assert = require("assert");
const path = require("path");
const process = require("process");
const test = require("node:test");

const codex = require(path.resolve(process.cwd(), "src", "drivers", "codex.js"));

async function withCodexEnvironment(fixtureName, timeoutMs, callback) {
    const previousCommand = process.env.CODEX_COMMAND;
    const previousKey = process.env.OPENAI_API_KEY;
    const previousTimeout = process.env.CODEX_TIMEOUT_MS;

    process.env.CODEX_COMMAND = path.resolve(process.cwd(), "tests", "fixtures", fixtureName);
    process.env.CODEX_TIMEOUT_MS = String(timeoutMs);

    try {
        return await callback();
    } finally {
        if (previousCommand === undefined) {
            delete process.env.CODEX_COMMAND;
        } else {
            process.env.CODEX_COMMAND = previousCommand;
        }

        if (previousKey === undefined) {
            delete process.env.OPENAI_API_KEY;
        } else {
            process.env.OPENAI_API_KEY = previousKey;
        }

        if (previousTimeout === undefined) {
            delete process.env.CODEX_TIMEOUT_MS;
        } else {
            process.env.CODEX_TIMEOUT_MS = previousTimeout;
        }
    }
}

test("Codex status reports an authenticated fixture", async function () {
    await withCodexEnvironment("fakeCodex.js", 2000, async function () {
        const result = await codex({action: "status"});

        assert.deepEqual(result, {
            authenticated: true,
            available: true,
            provider: "codex",
            version: "codex-cli 0.test.0"
        });
    });
});

test("Codex status reports a missing command without exposing process details", async function () {
    await withCodexEnvironment("missingCodex.js", 2000, async function () {
        const result = await codex({action: "status"});

        assert.equal(result.available, false);
        assert.equal(result.authenticated, false);
        assert.equal(result.version, null);
    });
});

test("Codex status reports an unauthenticated CLI", async function () {
    await withCodexEnvironment("fakeCodexUnauthenticated.js", 2000, async function () {
        const result = await codex({action: "status"});

        assert.equal(result.available, true);
        assert.equal(result.authenticated, false);
    });
});

test("Codex smoke uses stdin, validates JSONL, and isolates secrets", async function () {
    await withCodexEnvironment("fakeCodex.js", 2000, async function () {
        process.env.OPENAI_API_KEY = "must-not-reach-the-child";
        const result = await codex({action: "smoke"});

        assert.equal(result.status, "ok");
        assert.equal(result.message, "Secrets are isolated.");
        assert.equal(result.provider, "codex");
    });
});

test("Codex smoke rejects malformed JSONL", async function () {
    await withCodexEnvironment("fakeCodexMalformed.js", 2000, async function () {
        await assert.rejects(
            codex({action: "smoke"}),
            function (error) {
                return error.code === "CODEX_PROTOCOL_ERROR";
            }
        );
    });
});

test("Codex smoke times out and can be cancelled", async function () {
    await withCodexEnvironment("fakeCodexSlow.js", 50, async function () {
        await assert.rejects(
            codex({action: "smoke"}),
            function (error) {
                return error.code === "CODEX_TIMEOUT";
            }
        );
    });

    await withCodexEnvironment("fakeCodexSlow.js", 5000, async function () {
        const controller = new AbortController();
        const execution = codex({action: "smoke", signal: controller.signal});

        setTimeout(function () {
            controller.abort();
        }, 50);

        await assert.rejects(
            execution,
            function (error) {
                return error.code === "CODEX_CANCELLED";
            }
        );
    });
});

test("Codex rejects an already cancelled signal", async function () {
    await withCodexEnvironment("fakeCodexSlow.js", 5000, async function () {
        const controller = new AbortController();
        controller.abort();

        await assert.rejects(
            codex({action: "smoke", signal: controller.signal}),
            function (error) {
                return error.code === "CODEX_CANCELLED";
            }
        );
    });
});

