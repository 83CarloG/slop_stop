"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createApp = require(path.resolve(process.cwd(), "server", "app.js"));

async function withEventStore(callback) {
    const previousPath = process.env.EVENT_STORE_PATH;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-task-http-"));
    process.env.EVENT_STORE_PATH = path.resolve(directory, "events.jsonl");

    try {
        return await callback();
    } finally {
        if (previousPath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousPath;
        }

        fs.rmSync(directory, {force: true, recursive: true});
    }
}

test("the HTTP contract preserves the complete task derivation chain", async function () {
    await withEventStore(async function () {
        let app = createApp();
        let functionalRequirementId;
        let technicalRequirementId;
        let taskId;

        try {
            const functionalCreate = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    source: "Business Plan, Traceability section",
                    statement: "A reviewer can trace a task to its functional intent.",
                    title: "Trace task intent"
                },
                url: "/api/functional-requirements"
            });
            functionalRequirementId = functionalCreate.json().id;
            await app.inject({
                method: "POST",
                payload: {actorName: "Carlo"},
                url: `/api/functional-requirements/${functionalRequirementId}/review`
            });
            await app.inject({
                method: "POST",
                payload: {actorName: "Carlo", decision: "approved", note: "Approved as technical origin."},
                url: `/api/functional-requirements/${functionalRequirementId}/decisions`
            });

            const technicalCreate = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    functionalRequirementId,
                    statement: "Persist the task derivation chain.",
                    title: "Persist task traceability"
                },
                url: "/api/technical-requirements"
            });
            technicalRequirementId = technicalCreate.json().id;

            const prematureTask = await app.inject({
                method: "POST",
                payload: {
                    acceptanceCriteria: ["The request is rejected while the technical origin is a draft."],
                    actorName: "Carlo",
                    objective: "Attempt premature task creation.",
                    technicalRequirementId,
                    title: "Premature task"
                },
                url: "/api/tasks"
            });
            assert.equal(prematureTask.statusCode, 409);
            assert.equal(prematureTask.json().code, "TECHNICAL_REQUIREMENT_NOT_APPROVED");

            await app.inject({
                method: "POST",
                payload: {actorName: "Carlo"},
                url: `/api/technical-requirements/${technicalRequirementId}/review`
            });
            await app.inject({
                method: "POST",
                payload: {actorName: "Carlo", decision: "approved", note: "Approved as task origin."},
                url: `/api/technical-requirements/${technicalRequirementId}/decisions`
            });

            const taskCreate = await app.inject({
                method: "POST",
                payload: {
                    acceptanceCriteria: ["The task stores the technical requirement ID and approved version."],
                    actorName: "Carlo",
                    objective: "Create a traceable task draft.",
                    technicalRequirementId,
                    title: "Create task traceability"
                },
                url: "/api/tasks"
            });
            assert.equal(taskCreate.statusCode, 201);
            taskId = taskCreate.json().id;
            assert.equal(taskCreate.json().technicalRequirementId, technicalRequirementId);
            assert.equal(taskCreate.json().technicalRequirementVersion, 1);

            const filtered = await app.inject({
                method: "GET",
                url: `/api/tasks?technicalRequirementId=${technicalRequirementId}`
            });
            assert.equal(filtered.statusCode, 200);
            assert.equal(filtered.json().items.length, 1);

            const revision = await app.inject({
                method: "POST",
                payload: {
                    acceptanceCriteria: [
                        "The task stores the technical requirement ID and approved version.",
                        "The earlier task version remains available."
                    ],
                    actorName: "Carlo",
                    note: "Added immutable revision evidence.",
                    objective: "Create a traceable and versioned task draft.",
                    title: "Create versioned task traceability"
                },
                url: `/api/tasks/${taskId}/revisions`
            });
            assert.equal(revision.statusCode, 201);
            assert.equal(revision.json().currentVersion, 2);
        } finally {
            await app.close();
        }

        app = createApp();

        try {
            const persistedTask = await app.inject({method: "GET", url: `/api/tasks/${taskId}`});
            const persistedTechnical = await app.inject({
                method: "GET",
                url: `/api/technical-requirements/${persistedTask.json().technicalRequirementId}`
            });

            assert.equal(persistedTask.statusCode, 200);
            assert.equal(persistedTask.json().technicalRequirementId, technicalRequirementId);
            assert.equal(persistedTask.json().technicalRequirementVersion, 1);
            assert.equal(persistedTask.json().versions.length, 2);
            assert.equal(persistedTechnical.json().functionalRequirementId, functionalRequirementId);

            const missing = await app.inject({method: "GET", url: `/api/tasks/${crypto.randomUUID()}`});
            assert.equal(missing.statusCode, 404);
            assert.equal(missing.json().code, "TASK_NOT_FOUND");
        } finally {
            await app.close();
        }
    });
});

