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
const evaluateTaskReadiness = require(path.resolve(process.cwd(), "src", "services", "evaluateTaskReadiness.js"));
const getTaskTrace = require(path.resolve(process.cwd(), "src", "services", "getTaskTrace.js"));
const reviseTask = require(path.resolve(process.cwd(), "src", "services", "reviseTask.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

async function withEventStore(callback) {
    const previousPath = process.env.EVENT_STORE_PATH;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-trace-"));
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

async function createTraceableTask() {
    const functional = await createFunctionalRequirement({
        actorName: "Product owner",
        source: "Business Plan, governance section",
        statement: "A reviewer can trace implementation work to product intent.",
        title: "Trace product intent"
    });
    await submitFunctionalRequirementReview({actorName: "Reviewer", requirementId: functional.id});
    const approvedFunctional = await decideFunctionalRequirement({
        actorName: "Reviewer",
        decision: "approved",
        note: "Functional intent approved.",
        requirementId: functional.id
    });
    const technical = await createTechnicalRequirement({
        actorName: "Engineer",
        functionalRequirementId: functional.id,
        statement: "Expose a normalized read-only process trace.",
        title: "Build process trace"
    });
    await submitTechnicalRequirementReview({actorName: "Reviewer", requirementId: technical.id});
    const approvedTechnical = await decideTechnicalRequirement({
        actorName: "Reviewer",
        decision: "approved",
        note: "Technical derivation approved.",
        requirementId: technical.id
    });
    const task = await createTask({
        acceptanceCriteria: ["The trace contains the complete derivation chain."],
        actorName: "Engineer",
        objective: "Make process evidence readable from one task.",
        technicalRequirementId: technical.id,
        title: "Expose task trace"
    });
    const revisedTask = await reviseTask({
        acceptanceCriteria: ["The trace contains the complete derivation chain.", "Raw provider data is absent."],
        actorName: "Engineer",
        note: "Added the redaction boundary.",
        objective: "Make normalized process evidence readable from one task.",
        taskId: task.id,
        title: "Expose normalized task trace"
    });

    return {approvedFunctional, approvedTechnical, task: revisedTask};
}

test("a task trace normalizes its complete chain and chronological evidence", async function () {
    await withEventStore(async function () {
        const created = await createTraceableTask();
        const trace = await getTaskTrace({taskId: created.task.id});

        assert.equal(trace.taskId, created.task.id);
        assert.deepEqual(Object.keys(trace.chain), ["functionalRequirement", "technicalRequirement", "task"]);
        assert.equal(trace.chain.functionalRequirement.id, created.approvedFunctional.id);
        assert.equal(trace.chain.functionalRequirement.version, created.approvedFunctional.approvedVersion);
        assert.equal(trace.chain.technicalRequirement.id, created.approvedTechnical.id);
        assert.equal(trace.chain.technicalRequirement.version, created.approvedTechnical.approvedVersion);
        assert.equal(trace.chain.task.title, "Expose normalized task trace");
        assert.equal(trace.chain.task.version, 2);
        assert.deepEqual(trace.timeline.map(function (event) {
            return event.eventType;
        }), [
            "functional_requirement_created",
            "functional_requirement_review_submitted",
            "functional_requirement_decided",
            "technical_requirement_created",
            "technical_requirement_review_submitted",
            "technical_requirement_decided",
            "task_created",
            "task_revised"
        ]);
        assert.equal(trace.timeline[0].actor.name, "Product owner");
        assert.equal(trace.timeline[2].note, "Functional intent approved.");
        assert.equal(trace.timeline[7].subject.title, "Expose normalized task trace");
        assert.equal(trace.timeline[7].subject.version, 2);

        const serialized = JSON.stringify(trace);
        assert.equal(serialized.includes("eventId"), false);
        assert.equal(serialized.includes("payload"), false);
        assert.equal(serialized.includes("reasoning"), false);
        assert.equal(serialized.includes("prompt"), false);

        await evaluateTaskReadiness({taskId: created.task.id});
        const checkedTrace = await getTaskTrace({taskId: created.task.id});
        assert.equal(checkedTrace.timeline.at(-1).eventType, "task_check_evaluated");
        assert.deepEqual(checkedTrace.timeline.at(-1).result, {
            checkId: "approved_chain",
            consequence: "stop",
            status: "failed"
        });
    });
});

test("a task trace remains readable after a new service instance", async function () {
    await withEventStore(async function () {
        const created = await createTraceableTask();
        const firstRead = await getTaskTrace({taskId: created.task.id});
        const secondRead = await getTaskTrace({taskId: created.task.id});

        assert.deepEqual(secondRead, firstRead);
    });
});

test("missing tasks and broken trace origins return explicit errors", async function () {
    await withEventStore(async function (storePath) {
        await assert.rejects(getTaskTrace({taskId: "00000000-0000-4000-8000-000000000001"}), function (error) {
            assert.equal(error.code, "TASK_NOT_FOUND");
            return true;
        });

        fs.writeFileSync(storePath, `${JSON.stringify({
            actor: {kind: "human", name: "Engineer"},
            eventId: "00000000-0000-4000-8000-000000000002",
            eventType: "task_created",
            occurredAt: "2026-09-03T00:00:00.000Z",
            payload: {
                acceptanceCriteria: ["Broken origins are rejected."],
                objective: "Reject an orphan task.",
                taskId: "00000000-0000-4000-8000-000000000003",
                technicalRequirementVersion: 1,
                title: "Orphan task",
                version: 1
            },
            requirementId: "00000000-0000-4000-8000-000000000004",
            schemaVersion: 1
        })}\n`, "utf8");

        await assert.rejects(getTaskTrace({taskId: "00000000-0000-4000-8000-000000000003"}), function (error) {
            assert.equal(error.code, "STORE_CORRUPTED");
            return true;
        });
    });
});
