"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
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

test("Codex requirement review uses stdin and returns only structured output", async function () {
    await withCodexEnvironment("fakeCodex.js", 2000, async function () {
        process.env.OPENAI_API_KEY = "must-not-reach-the-child";
        const result = await codex({
            action: "reviewRequirement",
            requirement: {
                source: "Business Plan",
                statement: "User can export evidence.",
                title: "Export evidence",
                version: 1
            }
        });

        assert.equal(result.provider, "codex");
        assert.deepEqual(result.review, {
            ambiguities: ["The export format is not specified."],
            missingInformation: ["Define the evidence included in the export."],
            suggestedRevision: {
                statement: "The user can export requirement evidence as a JSON file.",
                title: "Export requirement evidence"
            },
            summary: "The intent is clear, but the result needs a format and evidence boundary."
        });
    });
});

test("Codex requirement review rejects malformed output and times out", async function () {
    const requirement = {
        source: "Business Plan",
        statement: "User can export evidence.",
        title: "Export evidence",
        version: 1
    };

    await withCodexEnvironment("fakeCodexMalformed.js", 2000, async function () {
        await assert.rejects(
            codex({action: "reviewRequirement", requirement}),
            function (error) {
                return error.code === "CODEX_PROTOCOL_ERROR";
            }
        );
    });

    await withCodexEnvironment("fakeCodexSlow.js", 50, async function () {
        await assert.rejects(
            codex({action: "reviewRequirement", requirement}),
            function (error) {
                return error.code === "CODEX_TIMEOUT";
            }
        );
    });
});

test("Codex task execution proposals are structured and isolated from the workspace", async function () {
    const approvedChain = {
        functionalRequirement: {statement: "Evidence can be exported.", title: "Export evidence", version: 1},
        task: {
            acceptanceCriteria: ["The export contains normalized evidence."],
            objective: "Add a bounded evidence export.",
            title: "Implement governed export",
            version: 1
        },
        technicalRequirement: {statement: "Expose a JSON export service.", title: "Build evidence export", version: 1}
    };

    await withCodexEnvironment("fakeCodex.js", 2000, async function () {
        process.env.OPENAI_API_KEY = "must-not-reach-the-child";
        const result = await codex({action: "proposeTaskExecution", approvedChain});

        assert.equal(result.provider, "codex");
        assert.deepEqual(result.proposal, {
            proposedChanges: [{
                description: "Add the bounded export service and its deterministic tests.",
                path: "src/services/exportEvidence.js"
            }],
            risks: ["Exported evidence may expose fields outside the normalized contract."],
            summary: "Implement a normalized evidence export behind the existing service boundary.",
            validationSteps: ["Run the deterministic unit and architecture test suites."]
        });
    });

    await withCodexEnvironment("fakeCodexMalformed.js", 2000, async function () {
        await assert.rejects(codex({action: "proposeTaskExecution", approvedChain}), function (error) {
            return error.code === "CODEX_PROTOCOL_ERROR";
        });
    });

    await withCodexEnvironment("fakeCodexSlow.js", 50, async function () {
        await assert.rejects(codex({action: "proposeTaskExecution", approvedChain}), function (error) {
            return error.code === "CODEX_TIMEOUT";
        });
    });
});

test("Codex task execution writes only inside an explicitly writable disposable workspace", async function () {
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-execution-driver-"));

    try {
        fs.mkdirSync(path.resolve(workspacePath, ".git"));
        fs.writeFileSync(path.resolve(workspacePath, ".git", "config"), "[core]\n\trepositoryformatversion = 0\n", "utf8");

        await withCodexEnvironment("fakeCodex.js", 2000, async function () {
            process.env.OPENAI_API_KEY = "must-not-reach-the-child";
            const result = await codex({
                action: "executeTask",
                executionContext: {
                    approvedChain: {task: {title: "Implement governed export"}},
                    proposal: {summary: "Implement the approved task."}
                },
                workspacePath
            });

            assert.equal(result.provider, "codex");
            assert.equal(result.result.summary, "Created one isolated implementation candidate.");
            assert.deepEqual(result.result.validationNotes, ["No independent verification was performed."]);
            assert.equal(
                fs.readFileSync(path.resolve(workspacePath, "m5bCandidate.txt"), "utf8"),
                "Generated only inside the disposable workspace.\n"
            );
        });
    } finally {
        fs.rmSync(workspacePath, {force: true, recursive: true});
    }
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
