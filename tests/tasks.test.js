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
const decideTask = require(path.resolve(process.cwd(), "src", "services", "decideTask.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const evaluateTaskReadiness = require(path.resolve(process.cwd(), "src", "services", "evaluateTaskReadiness.js"));
const listFunctionalRequirements = require(path.resolve(process.cwd(), "src", "services", "listFunctionalRequirements.js"));
const listTasks = require(path.resolve(process.cwd(), "src", "services", "listTasks.js"));
const listTechnicalRequirements = require(path.resolve(process.cwd(), "src", "services", "listTechnicalRequirements.js"));
const reviseTask = require(path.resolve(process.cwd(), "src", "services", "reviseTask.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTaskReview = require(path.resolve(process.cwd(), "src", "services", "submitTaskReview.js"));
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

test("task review and approval preserve an immutable human decision", async function () {
    await withEventStore(async function (storePath) {
        const {technicalRequirement} = await createApprovedTechnicalRequirement();
        const task = await createTask({
            acceptanceCriteria: ["A human reviewer approves the task before gating."],
            actorName: "Author",
            objective: "Establish an approved input for deterministic gates.",
            technicalRequirementId: technicalRequirement.id,
            title: "Approve gate input"
        });
        const inReview = await submitTaskReview({actorName: "Reviewer", taskId: task.id});
        const approved = await decideTask({
            actorName: "Reviewer",
            decision: "approved",
            note: "The task is bounded and verifiable.",
            taskId: task.id
        });

        assert.equal(inReview.status, "in_review");
        assert.equal(approved.status, "approved");
        assert.equal(approved.approvedVersion, 1);
        assert.equal(approved.decision.actor.name, "Reviewer");
        assert.equal(approved.decision.note, "The task is bounded and verifiable.");
        assert.deepEqual(approved.timeline.slice(-2).map(function (event) {
            return event.eventType;
        }), ["task_review_submitted", "task_decided"]);

        await assert.rejects(reviseTask({
            acceptanceCriteria: ["Approved tasks cannot be revised."],
            actorName: "Author",
            note: "This must fail.",
            objective: "Attempt to change approved work.",
            taskId: task.id,
            title: "Change approved task"
        }), assertCode("INVALID_TASK_TRANSITION"));
        await assert.rejects(decideTask({
            actorName: "Reviewer",
            decision: "approved",
            note: "Duplicate decision.",
            taskId: task.id
        }), assertCode("INVALID_TASK_TRANSITION"));

        const events = fs.readFileSync(storePath, "utf8").trim().split("\n").map(JSON.parse);
        assert.deepEqual(events.slice(-2).map(function (event) {
            return event.eventType;
        }), ["task_review_submitted", "task_decided"]);
        assert.equal(events.at(-1).payload.taskId, task.id);
    });
});

test("the approved-chain check stops a draft and allows its approved version", async function () {
    await withEventStore(async function (storePath) {
        const {technicalRequirement} = await createApprovedTechnicalRequirement();
        const task = await createTask({
            acceptanceCriteria: ["The deterministic chain check records an explicit consequence."],
            actorName: "Author",
            objective: "Prove that task readiness does not depend on an AI judgment.",
            technicalRequirementId: technicalRequirement.id,
            title: "Evaluate approved chain"
        });
        const stopped = await evaluateTaskReadiness({taskId: task.id});

        assert.equal(stopped.checks.length, 1);
        assert.equal(stopped.checks[0].status, "failed");
        assert.equal(stopped.checks[0].consequence, "stop");
        assert.equal(stopped.checks[0].rules[0].status, "failed");
        assert.equal(stopped.checks[0].rules[1].status, "passed");
        assert.equal(stopped.checks[0].rules[2].status, "passed");

        await submitTaskReview({actorName: "Reviewer", taskId: task.id});
        const intervention = await evaluateTaskReadiness({taskId: task.id});
        assert.equal(intervention.checks.at(-1).status, "failed");
        assert.equal(intervention.checks.at(-1).consequence, "human_intervention");
        await decideTask({
            actorName: "Reviewer",
            decision: "approved",
            note: "The task is ready for deterministic evaluation.",
            taskId: task.id
        });
        const allowed = await evaluateTaskReadiness({taskId: task.id});
        const latestCheck = allowed.checks.at(-1);

        assert.equal(latestCheck.status, "passed");
        assert.equal(latestCheck.consequence, "allow");
        assert.equal(latestCheck.actor.kind, "system");
        assert.equal(latestCheck.actor.name, "readiness-check");
        assert.equal(latestCheck.version, 1);
        assert.deepEqual(latestCheck.rules.map(function (rule) {
            return rule.status;
        }), ["passed", "passed", "passed"]);

        const events = fs.readFileSync(storePath, "utf8").trim().split("\n").map(JSON.parse);
        assert.equal(events.filter(function (event) {
            return event.eventType === "task_check_evaluated";
        }).length, 3);
    });
});

test("a forged readiness result corrupts the task history", async function () {
    await withEventStore(async function (storePath) {
        const {technicalRequirement} = await createApprovedTechnicalRequirement();
        const task = await createTask({
            acceptanceCriteria: ["Stored readiness evidence is replayed deterministically."],
            actorName: "Author",
            objective: "Reject a false allow result for a draft task.",
            technicalRequirementId: technicalRequirement.id,
            title: "Validate readiness evidence"
        });

        fs.appendFileSync(storePath, `${JSON.stringify({
            actor: {kind: "system", name: "readiness-check"},
            eventId: "forged-readiness-event",
            eventType: "task_check_evaluated",
            occurredAt: "2026-09-03T01:00:00.000Z",
            payload: {
                checkId: "approved_chain",
                consequence: "allow",
                rules: [
                    {ruleId: "task_version_approved", status: "passed"},
                    {ruleId: "technical_origin_approved", status: "passed"},
                    {ruleId: "functional_origin_approved", status: "passed"}
                ],
                status: "passed",
                taskId: task.id,
                version: task.currentVersion
            },
            requirementId: technicalRequirement.id,
            schemaVersion: 1
        })}\n`, "utf8");

        await assert.rejects(listTasks(), assertCode("STORE_CORRUPTED"));
    });
});

test("a rejected task returns to draft only through a new revision", async function () {
    await withEventStore(async function () {
        const {technicalRequirement} = await createApprovedTechnicalRequirement();
        const task = await createTask({
            acceptanceCriteria: ["The initial criterion is reviewed."],
            actorName: "Author",
            objective: "Create a task that requires clarification.",
            technicalRequirementId: technicalRequirement.id,
            title: "Clarify gate input"
        });
        await submitTaskReview({actorName: "Reviewer", taskId: task.id});
        const rejected = await decideTask({
            actorName: "Reviewer",
            decision: "rejected",
            note: "The criterion is not sufficiently precise.",
            taskId: task.id
        });

        assert.equal(rejected.status, "rejected");
        assert.equal(rejected.approvedVersion, null);
        const stopped = await evaluateTaskReadiness({taskId: task.id});
        assert.equal(stopped.checks.at(-1).consequence, "stop");
        await assert.rejects(submitTaskReview({actorName: "Reviewer", taskId: task.id}), assertCode("INVALID_TASK_TRANSITION"));

        const revised = await reviseTask({
            acceptanceCriteria: ["The deterministic result is explicitly observable."],
            actorName: "Author",
            note: "Made the expected result precise.",
            objective: "Create a task with a deterministic acceptance result.",
            taskId: task.id,
            title: "Clarify deterministic gate input"
        });

        assert.equal(revised.status, "draft");
        assert.equal(revised.currentVersion, 2);
        assert.equal(revised.decision, null);
        assert.equal(revised.versions.length, 2);
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
