"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const createTask = require(path.resolve(process.cwd(), "src", "services", "createTask.js"));
const createTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "createTechnicalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const listFunctionalRequirements = require(path.resolve(process.cwd(), "src", "services", "listFunctionalRequirements.js"));
const listTasks = require(path.resolve(process.cwd(), "src", "services", "listTasks.js"));
const listTechnicalRequirements = require(path.resolve(process.cwd(), "src", "services", "listTechnicalRequirements.js"));
const reviseTask = require(path.resolve(process.cwd(), "src", "services", "reviseTask.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

async function withEventStore(callback) {
    const previousPath = process.env.EVENT_STORE_PATH;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-tasks-"));
    const storePath = path.resolve(directory, "events.jsonl");
    process.env.EVENT_STORE_PATH = storePath;

    try {
        return await callback(storePath);
    } finally {
        if (previousPath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousPath;
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

async function createApprovedFunctionalRequirement() {
    const created = await createFunctionalRequirement({
        actorName: "Carlo",
        source: "Business Plan, Traceability section",
        statement: "Implementation work remains traceable to functional intent.",
        title: "Trace implementation work"
    });
    await submitFunctionalRequirementReview({actorName: "Carlo", requirementId: created.id});
    return await decideFunctionalRequirement({
        actorName: "Carlo",
        decision: "approved",
        note: "Approved as functional origin.",
        requirementId: created.id
    });
}

async function createApprovedTechnicalRequirement() {
    const functionalRequirement = await createApprovedFunctionalRequirement();
    const created = await createTechnicalRequirement({
        actorName: "Carlo",
        functionalRequirementId: functionalRequirement.id,
        statement: "Persist task derivation from an approved technical version.",
        title: "Persist task derivation"
    });
    await submitTechnicalRequirementReview({actorName: "Carlo", requirementId: created.id});
    const technicalRequirement = await decideTechnicalRequirement({
        actorName: "Carlo",
        decision: "approved",
        note: "Approved as task origin.",
        requirementId: created.id
    });

    return {functionalRequirement, technicalRequirement};
}

test("one approved technical version can originate multiple draft tasks", async function () {
    await withEventStore(async function (storePath) {
        const {functionalRequirement, technicalRequirement} = await createApprovedTechnicalRequirement();
        const first = await createTask({
            acceptanceCriteria: ["The event contains the technical origin version."],
            actorName: "Carlo",
            objective: "Record the immutable task derivation link.",
            technicalRequirementId: technicalRequirement.id,
            title: "Record task origin"
        });
        const second = await createTask({
            acceptanceCriteria: ["The UI lists tasks under their technical origin."],
            actorName: "Carlo",
            objective: "Expose the task from the technical requirement view.",
            technicalRequirementId: technicalRequirement.id,
            title: "Navigate to tasks"
        });

        assert.notEqual(first.id, second.id);
        assert.equal(first.status, "draft");
        assert.equal(first.technicalRequirementId, technicalRequirement.id);
        assert.equal(first.technicalRequirementVersion, technicalRequirement.approvedVersion);

        const filtered = await listTasks({technicalRequirementId: technicalRequirement.id});
        assert.equal(filtered.items.length, 2);
        assert.deepEqual(new Set(filtered.items.map(function (task) {
            return task.technicalRequirementId;
        })), new Set([technicalRequirement.id]));

        assert.equal((await listFunctionalRequirements()).items.length, 1);
        assert.equal((await listTechnicalRequirements()).items.length, 1);
        assert.equal(technicalRequirement.functionalRequirementId, functionalRequirement.id);

        const events = fs.readFileSync(storePath, "utf8").trim().split("\n").map(JSON.parse);
        assert.deepEqual(events.slice(-2).map(function (event) {
            return event.eventType;
        }), ["task_created", "task_created"]);
        assert.deepEqual(events.slice(-2).map(function (event) {
            return event.requirementId;
        }), [technicalRequirement.id, technicalRequirement.id]);
    });
});

test("task revisions preserve origin, versions, actor, and criteria", async function () {
    await withEventStore(async function () {
        const {technicalRequirement} = await createApprovedTechnicalRequirement();
        const created = await createTask({
            acceptanceCriteria: ["The task has one immutable technical origin."],
            actorName: "Author",
            objective: "Create a traceable task draft.",
            technicalRequirementId: technicalRequirement.id,
            title: "Create traceable task"
        });
        const revised = await reviseTask({
            acceptanceCriteria: [
                "The task has one immutable technical origin.",
                "The task retains its earlier version."
            ],
            actorName: "Author",
            note: "Added version evidence.",
            objective: "Create a traceable and versioned task draft.",
            taskId: created.id,
            title: "Create versioned task"
        });

        assert.equal(revised.currentVersion, 2);
        assert.equal(revised.technicalRequirementId, technicalRequirement.id);
        assert.equal(revised.technicalRequirementVersion, technicalRequirement.approvedVersion);
        assert.equal(revised.versions[0].objective, "Create a traceable task draft.");
        assert.equal(revised.versions[1].acceptanceCriteria.length, 2);
        assert.equal(revised.timeline[1].actor.name, "Author");
        assert.equal(revised.timeline[1].note, "Added version evidence.");
        assert.equal(Number.isNaN(Date.parse(revised.timeline[1].occurredAt)), false);
    });
});

test("task creation requires an approved technical origin and valid criteria", async function () {
    await withEventStore(async function () {
        const functionalRequirement = await createApprovedFunctionalRequirement();
        const technicalRequirement = await createTechnicalRequirement({
            actorName: "Carlo",
            functionalRequirementId: functionalRequirement.id,
            statement: "A draft technical requirement cannot originate tasks.",
            title: "Require technical approval"
        });

        await assert.rejects(createTask({
            acceptanceCriteria: ["This task must not be created."],
            actorName: "Carlo",
            objective: "Create a premature task.",
            technicalRequirementId: technicalRequirement.id,
            title: "Premature task"
        }), assertCode("TECHNICAL_REQUIREMENT_NOT_APPROVED"));

        await assert.rejects(createTask({
            acceptanceCriteria: [],
            actorName: "Carlo",
            objective: "Create a task without acceptance criteria.",
            technicalRequirementId: technicalRequirement.id,
            title: "Invalid task"
        }), assertCode("INVALID_REQUEST"));

        await assert.rejects(createTask({
            acceptanceCriteria: ["The missing origin is rejected."],
            actorName: "Carlo",
            objective: "Reference a missing technical requirement.",
            technicalRequirementId: "00000000-0000-4000-8000-000000000000",
            title: "Missing origin task"
        }), assertCode("TECHNICAL_REQUIREMENT_NOT_FOUND"));
    });
});

test("an inconsistent task event history is rejected", async function () {
    await withEventStore(async function (storePath) {
        fs.writeFileSync(storePath, `${JSON.stringify({
            actor: {kind: "human", name: "Carlo"},
            eventId: "00000000-0000-4000-8000-000000000001",
            eventType: "task_revised",
            occurredAt: "2026-09-03T00:00:00.000Z",
            payload: {
                acceptanceCriteria: ["Invalid history is rejected."],
                note: "Missing creation event.",
                objective: "Reject inconsistent task history.",
                taskId: "00000000-0000-4000-8000-000000000002",
                title: "Invalid task history",
                version: 2
            },
            requirementId: "00000000-0000-4000-8000-000000000003",
            schemaVersion: 1
        })}\n`, "utf8");

        await assert.rejects(listTasks(), assertCode("STORE_CORRUPTED"));
    });
});

