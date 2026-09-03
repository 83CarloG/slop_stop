"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createApp = require(path.resolve(process.cwd(), "server", "app.js"));
const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const createTask = require(path.resolve(process.cwd(), "src", "services", "createTask.js"));
const createTaskExecutionCandidate = require(path.resolve(process.cwd(), "src", "services", "createTaskExecutionCandidate.js"));
const createTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "createTechnicalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTask = require(path.resolve(process.cwd(), "src", "services", "decideTask.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const evaluateTaskReadiness = require(path.resolve(process.cwd(), "src", "services", "evaluateTaskReadiness.js"));
const getTask = require(path.resolve(process.cwd(), "src", "services", "getTask.js"));
const getTaskExecutionPatch = require(path.resolve(process.cwd(), "src", "services", "getTaskExecutionPatch.js"));
const getTaskTrace = require(path.resolve(process.cwd(), "src", "services", "getTaskTrace.js"));
const proposeTaskExecution = require(path.resolve(process.cwd(), "src", "services", "proposeTaskExecution.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTaskReview = require(path.resolve(process.cwd(), "src", "services", "submitTaskReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

async function withEnvironment(fixtureName, timeoutMs, callback) {
    const previousCommand = process.env.CODEX_COMMAND;
    const previousKey = process.env.OPENAI_API_KEY;
    const previousPath = process.env.EVENT_STORE_PATH;
    const previousTimeout = process.env.CODEX_TIMEOUT_MS;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-candidate-"));

    process.env.CODEX_COMMAND = path.resolve(process.cwd(), "tests", "fixtures", fixtureName);
    process.env.CODEX_TIMEOUT_MS = String(timeoutMs);
    process.env.EVENT_STORE_PATH = path.resolve(directory, "events.jsonl");

    try {
        return await callback(directory);
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

        if (previousPath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousPath;
        }

        if (previousTimeout === undefined) {
            delete process.env.CODEX_TIMEOUT_MS;
        } else {
            process.env.CODEX_TIMEOUT_MS = previousTimeout;
        }

        fs.rmSync(directory, {force: true, recursive: true});
    }
}

function assertCode(expectedCode) {
    return function (error) {
        assert.equal(error.code, expectedCode);
        return true;
    };
}

async function createReadyTask(withProposal) {
    const functional = await createFunctionalRequirement({
        actorName: "Product owner",
        source: "M5B deterministic fixture",
        statement: "The user can review an isolated implementation candidate.",
        title: "Review an isolated candidate"
    });
    await submitFunctionalRequirementReview({actorName: "Reviewer", requirementId: functional.id});
    await decideFunctionalRequirement({
        actorName: "Reviewer",
        decision: "approved",
        note: "Approved functional origin.",
        requirementId: functional.id
    });
    const technical = await createTechnicalRequirement({
        actorName: "Engineer",
        functionalRequirementId: functional.id,
        statement: "Generate a patch only from a disposable Git snapshot.",
        title: "Generate an isolated patch"
    });
    await submitTechnicalRequirementReview({actorName: "Reviewer", requirementId: technical.id});
    await decideTechnicalRequirement({
        actorName: "Reviewer",
        decision: "approved",
        note: "Approved technical origin.",
        requirementId: technical.id
    });
    const task = await createTask({
        acceptanceCriteria: ["The source repository remains unchanged."],
        actorName: "Engineer",
        objective: "Create a reviewable candidate patch.",
        technicalRequirementId: technical.id,
        title: "Create isolated candidate"
    });
    await submitTaskReview({actorName: "Reviewer", taskId: task.id});
    await decideTask({
        actorName: "Reviewer",
        decision: "approved",
        note: "Approved for isolated execution.",
        taskId: task.id
    });
    await evaluateTaskReadiness({taskId: task.id});

    if (withProposal) {
        await proposeTaskExecution({confirmed: true, taskId: task.id});
    }

    return task.id;
}

test("an authorized execution stores a patch candidate without changing the source repository", async function () {
    await withEnvironment("fakeCodex.js", 5000, async function (directory) {
        process.env.OPENAI_API_KEY = "must-not-reach-the-child";
        const taskId = await createReadyTask(false);

        await assert.rejects(createTaskExecutionCandidate({
            actorName: "Reviewer",
            confirmed: true,
            note: "Authorize the disposable execution.",
            taskId
        }), assertCode("TASK_EXECUTION_NOT_READY"));

        await proposeTaskExecution({confirmed: true, taskId});
        await assert.rejects(createTaskExecutionCandidate({
            actorName: "Reviewer",
            confirmed: false,
            note: "Authorize the disposable execution.",
            taskId
        }), assertCode("INVALID_REQUEST"));

        const sourceStatusBefore = childProcess.execFileSync("git", ["status", "--short"], {
            cwd: process.cwd(),
            encoding: "utf8"
        });
        const result = await createTaskExecutionCandidate({
            actorName: "Reviewer",
            confirmed: true,
            note: "Authorize the disposable execution.",
            taskId
        });
        const execution = result.executions.at(-1);

        assert.equal(result.status, "approved");
        assert.equal(result.checks.at(-1).consequence, "allow");
        assert.equal(execution.status, "awaiting_review");
        assert.equal(execution.authorizedBy.name, "Reviewer");
        assert.equal(execution.note, "Authorize the disposable execution.");
        assert.deepEqual(execution.candidate.changedFiles, ["m5bCandidate.txt"]);
        assert.equal(execution.candidate.summary, "Created one isolated implementation candidate.");
        assert.deepEqual(execution.candidate.validationNotes, ["No independent verification was performed."]);
        assert.match(execution.candidate.patchSha256, /^[0-9a-f]{64}$/u);
        assert.equal(fs.existsSync(path.resolve(process.cwd(), "m5bCandidate.txt")), false);
        assert.equal(childProcess.execFileSync("git", ["status", "--short"], {
            cwd: process.cwd(),
            encoding: "utf8"
        }), sourceStatusBefore);

        const patch = await getTaskExecutionPatch({executionId: execution.id, taskId});

        assert.match(patch.content, /Generated only inside the disposable workspace/u);
        assert.equal(patch.patchSha256, execution.candidate.patchSha256);
        assert.equal(fs.existsSync(path.resolve(directory, execution.candidate.artifact)), true);

        const trace = await getTaskTrace({taskId});
        assert.deepEqual(trace.timeline.slice(-2).map(function (event) {
            return event.eventType;
        }), ["task_execution_authorized", "task_execution_candidate_created"]);

        const stored = fs.readFileSync(path.resolve(directory, "events.jsonl"), "utf8");
        assert.equal(stored.includes("Execution context JSON"), false);
        assert.equal(stored.includes("reasoning"), false);
        assert.equal(stored.includes("diff --git"), false);
    });
});

test("the HTTP boundary authorizes execution and serves only its integrity-checked patch", async function () {
    await withEnvironment("fakeCodex.js", 5000, async function () {
        const taskId = await createReadyTask(true);
        const app = createApp();

        try {
            const invalid = await app.inject({
                method: "POST",
                payload: {actorName: "Reviewer", confirmed: true},
                url: `/api/tasks/${taskId}/executions`
            });
            assert.equal(invalid.statusCode, 400);

            const response = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Reviewer",
                    confirmed: true,
                    note: "Authorize one disposable execution."
                },
                url: `/api/tasks/${taskId}/executions`
            });
            const execution = response.json().executions.at(-1);

            assert.equal(response.statusCode, 200);
            assert.equal(execution.status, "awaiting_review");

            const patchResponse = await app.inject({
                method: "GET",
                url: `/api/tasks/${taskId}/executions/${execution.id}/patch`
            });

            assert.equal(patchResponse.statusCode, 200);
            assert.match(patchResponse.headers["content-type"], /^text\/x-diff/u);
            assert.equal(patchResponse.headers.etag, `"${execution.candidate.patchSha256}"`);
            assert.match(patchResponse.body, /m5bCandidate\.txt/u);
        } finally {
            await app.close();
        }
    });
});

test("provider failures become normalized execution evidence without patch artifacts", async function () {
    for (const scenario of [
        {code: "CODEX_PROTOCOL_ERROR", fixture: "fakeCodexMalformed.js", timeoutMs: 5000},
        {code: "CODEX_TIMEOUT", fixture: "fakeCodexSlow.js", timeoutMs: 50}
    ]) {
        await withEnvironment("fakeCodex.js", 5000, async function (directory) {
            const taskId = await createReadyTask(true);

            process.env.CODEX_COMMAND = path.resolve(process.cwd(), "tests", "fixtures", scenario.fixture);
            process.env.CODEX_TIMEOUT_MS = String(scenario.timeoutMs);

            await assert.rejects(createTaskExecutionCandidate({
                actorName: "Reviewer",
                confirmed: true,
                note: "Authorize a failing disposable execution.",
                taskId
            }), assertCode(scenario.code));

            const task = await getTask({taskId});
            const execution = task.executions.at(-1);

            assert.equal(execution.status, "failed");
            assert.equal(execution.failure.code, scenario.code);
            assert.equal(fs.existsSync(path.resolve(directory, "executions")), false);
        });
    }
});
