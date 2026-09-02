"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const listFunctionalRequirements = require(path.resolve(process.cwd(), "src", "services", "listFunctionalRequirements.js"));
const reviseFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseFunctionalRequirement.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));

async function withEventStore(callback) {
    const previousPath = process.env.EVENT_STORE_PATH;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-events-"));
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

test("a functional requirement keeps immutable versions and human evidence", async function () {
    await withEventStore(async function (storePath) {
        const created = await createFunctionalRequirement({
            actorName: "Carlo",
            source: "Short Business Plan, Product section",
            statement: "The user can record a functional requirement.",
            title: "Record a requirement"
        });

        assert.equal(created.currentVersion, 1);
        assert.equal(created.status, "draft");
        assert.equal(created.versions[0].actor.name, "Carlo");
        assert.equal(created.versions[0].source, "Short Business Plan, Product section");
        assert.equal(Number.isNaN(Date.parse(created.createdAt)), false);

        const revised = await reviseFunctionalRequirement({
            actorName: "Carlo",
            note: "Clarified the expected result.",
            requirementId: created.id,
            statement: "The user can record and retrieve a functional requirement.",
            title: "Record and retrieve a requirement"
        });

        assert.equal(revised.currentVersion, 2);
        assert.equal(revised.versions.length, 2);
        assert.equal(revised.versions[0].statement, "The user can record a functional requirement.");
        assert.equal(revised.versions[1].statement, "The user can record and retrieve a functional requirement.");

        const inReview = await submitFunctionalRequirementReview({
            actorName: "Carlo",
            requirementId: created.id
        });
        assert.equal(inReview.status, "in_review");

        const approved = await decideFunctionalRequirement({
            actorName: "Carlo",
            decision: "approved",
            note: "Approved for Milestone 1.",
            requirementId: created.id
        });

        assert.equal(approved.status, "approved");
        assert.equal(approved.approvedVersion, 2);
        assert.equal(approved.decision.actor.name, "Carlo");
        assert.equal(approved.decision.note, "Approved for Milestone 1.");
        assert.deepEqual(approved.timeline.map(function (event) {
            return event.eventType;
        }), [
            "functional_requirement_created",
            "functional_requirement_revised",
            "functional_requirement_review_submitted",
            "functional_requirement_decided"
        ]);
        assert.equal(approved.timeline[2].actor.name, "Carlo");
        assert.equal(Number.isNaN(Date.parse(approved.timeline[2].occurredAt)), false);

        await assert.rejects(decideFunctionalRequirement({
            actorName: "Carlo",
            decision: "approved",
            note: "Duplicate decision.",
            requirementId: created.id
        }), assertCode("INVALID_TRANSITION"));
        await assert.rejects(reviseFunctionalRequirement({
            actorName: "Carlo",
            note: "Attempted approved edit.",
            requirementId: created.id,
            statement: "This must not replace approved evidence.",
            title: "Forbidden revision"
        }), assertCode("INVALID_TRANSITION"));

        const persistedEvents = fs.readFileSync(storePath, "utf8").trim().split("\n").map(JSON.parse);
        assert.equal(persistedEvents.length, 4);
        assert.equal(new Set(persistedEvents.map(function (event) {
            return event.eventId;
        })).size, 4);
        assert.deepEqual(persistedEvents.map(function (event) {
            return event.requirementId;
        }), [created.id, created.id, created.id, created.id]);
    });
});

test("rejection permits a new draft while approval from draft is blocked", async function () {
    await withEventStore(async function () {
        const created = await createFunctionalRequirement({
            actorName: "Author",
            source: "Extended Business Plan, Workflow section",
            statement: "The user can revise a rejected requirement.",
            title: "Revise rejected requirement"
        });

        await assert.rejects(decideFunctionalRequirement({
            actorName: "Reviewer",
            decision: "approved",
            note: "Premature approval.",
            requirementId: created.id
        }), assertCode("INVALID_TRANSITION"));

        await submitFunctionalRequirementReview({actorName: "Author", requirementId: created.id});
        const rejected = await decideFunctionalRequirement({
            actorName: "Reviewer",
            decision: "rejected",
            note: "The result needs a clearer boundary.",
            requirementId: created.id
        });
        assert.equal(rejected.status, "rejected");

        const revised = await reviseFunctionalRequirement({
            actorName: "Author",
            note: "Added the missing boundary.",
            requirementId: created.id,
            statement: "The user can revise a rejected, non-approved requirement.",
            title: "Revise a rejected requirement"
        });
        assert.equal(revised.currentVersion, 2);
        assert.equal(revised.status, "draft");
        assert.equal(revised.decision, null);
    });
});

test("malformed JSONL blocks reads and writes", async function () {
    await withEventStore(async function (storePath) {
        fs.writeFileSync(storePath, "{not-json}\n", "utf8");

        await assert.rejects(listFunctionalRequirements(), assertCode("STORE_CORRUPTED"));
        await assert.rejects(createFunctionalRequirement({
            actorName: "Carlo",
            source: "Business Plan",
            statement: "This write must be blocked.",
            title: "Blocked write"
        }), assertCode("STORE_CORRUPTED"));
        assert.equal(fs.readFileSync(storePath, "utf8"), "{not-json}\n");
    });
});
