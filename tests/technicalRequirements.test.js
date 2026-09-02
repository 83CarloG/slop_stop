"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const createTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "createTechnicalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const listFunctionalRequirements = require(path.resolve(process.cwd(), "src", "services", "listFunctionalRequirements.js"));
const listTechnicalRequirements = require(path.resolve(process.cwd(), "src", "services", "listTechnicalRequirements.js"));
const reviseTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseTechnicalRequirement.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

async function withEventStore(callback) {
    const previousPath = process.env.EVENT_STORE_PATH;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-technical-"));
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
        statement: "A functional requirement can originate multiple technical requirements.",
        title: "Trace functional intent"
    });

    await submitFunctionalRequirementReview({actorName: "Carlo", requirementId: created.id});
    return await decideFunctionalRequirement({
        actorName: "Carlo",
        decision: "approved",
        note: "Approved as the technical origin.",
        requirementId: created.id
    });
}

test("one approved functional version can originate multiple technical requirements", async function () {
    await withEventStore(async function (storePath) {
        const functionalRequirement = await createApprovedFunctionalRequirement();
        const first = await createTechnicalRequirement({
            actorName: "Carlo",
            functionalRequirementId: functionalRequirement.id,
            statement: "The API stores the immutable functional origin identifier and version.",
            title: "Persist technical origin"
        });
        const second = await createTechnicalRequirement({
            actorName: "Carlo",
            functionalRequirementId: functionalRequirement.id,
            statement: "The UI lists every technical requirement derived from the selected functional requirement.",
            title: "Navigate technical derivations"
        });

        assert.notEqual(first.id, second.id);
        assert.equal(first.functionalRequirementId, functionalRequirement.id);
        assert.equal(first.functionalRequirementVersion, functionalRequirement.approvedVersion);
        assert.equal(first.status, "draft");

        const filtered = await listTechnicalRequirements({functionalRequirementId: functionalRequirement.id});
        assert.equal(filtered.items.length, 2);
        assert.deepEqual(new Set(filtered.items.map(function (item) {
            return item.functionalRequirementId;
        })), new Set([functionalRequirement.id]));

        const functionalItems = await listFunctionalRequirements();
        assert.equal(functionalItems.items.length, 1);

        const persistedEvents = fs.readFileSync(storePath, "utf8").trim().split("\n").map(JSON.parse);
        assert.deepEqual(persistedEvents.slice(-2).map(function (event) {
            return event.eventType;
        }), ["technical_requirement_created", "technical_requirement_created"]);
    });
});

test("technical requirements preserve versions, origin, and human decisions", async function () {
    await withEventStore(async function () {
        const functionalRequirement = await createApprovedFunctionalRequirement();
        const created = await createTechnicalRequirement({
            actorName: "Author",
            functionalRequirementId: functionalRequirement.id,
            statement: "The application records a technical requirement.",
            title: "Record technical requirement"
        });
        const revised = await reviseTechnicalRequirement({
            actorName: "Author",
            note: "Added the traceability boundary.",
            requirementId: created.id,
            statement: "The application records a technical requirement with its immutable functional origin.",
            title: "Record traceable technical requirement"
        });

        assert.equal(revised.currentVersion, 2);
        assert.equal(revised.functionalRequirementId, functionalRequirement.id);
        assert.equal(revised.functionalRequirementVersion, functionalRequirement.approvedVersion);
        assert.equal(revised.versions[0].statement, "The application records a technical requirement.");

        const inReview = await submitTechnicalRequirementReview({
            actorName: "Reviewer",
            requirementId: created.id
        });
        assert.equal(inReview.status, "in_review");

        const approved = await decideTechnicalRequirement({
            actorName: "Reviewer",
            decision: "approved",
            note: "The derivation is clear and implementable.",
            requirementId: created.id
        });
        assert.equal(approved.status, "approved");
        assert.equal(approved.approvedVersion, 2);
        assert.equal(approved.decision.actor.name, "Reviewer");

        await assert.rejects(reviseTechnicalRequirement({
            actorName: "Author",
            note: "Attempted approved edit.",
            requirementId: created.id,
            statement: "This must not replace approved evidence.",
            title: "Forbidden revision"
        }), assertCode("INVALID_TECHNICAL_TRANSITION"));
        await assert.rejects(decideTechnicalRequirement({
            actorName: "Reviewer",
            decision: "approved",
            note: "Duplicate decision.",
            requirementId: created.id
        }), assertCode("INVALID_TECHNICAL_TRANSITION"));
    });
});

test("a technical requirement requires an approved functional origin", async function () {
    await withEventStore(async function () {
        const functionalRequirement = await createFunctionalRequirement({
            actorName: "Carlo",
            source: "Business Plan",
            statement: "A draft cannot yet originate technical work.",
            title: "Require approval"
        });

        await assert.rejects(createTechnicalRequirement({
            actorName: "Carlo",
            functionalRequirementId: functionalRequirement.id,
            statement: "This technical requirement is premature.",
            title: "Premature derivation"
        }), assertCode("FUNCTIONAL_REQUIREMENT_NOT_APPROVED"));

        await assert.rejects(createTechnicalRequirement({
            actorName: "Carlo",
            functionalRequirementId: "00000000-0000-4000-8000-000000000000",
            statement: "This technical requirement has no origin.",
            title: "Missing origin"
        }), assertCode("FUNCTIONAL_REQUIREMENT_NOT_FOUND"));
    });
});

