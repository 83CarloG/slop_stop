"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createApp = require(path.resolve(process.cwd(), "server", "app.js"));
const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const proposeFunctionalRequirementAiReview = require(path.resolve(process.cwd(), "src", "services", "proposeFunctionalRequirementAiReview.js"));
const reviseFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseFunctionalRequirement.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));

async function withEnvironment(fixtureName, callback) {
    const previousCommand = process.env.CODEX_COMMAND;
    const previousStorePath = process.env.EVENT_STORE_PATH;
    const previousTimeout = process.env.CODEX_TIMEOUT_MS;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-review-"));
    const storePath = path.resolve(directory, "events.jsonl");

    process.env.CODEX_COMMAND = path.resolve(process.cwd(), "tests", "fixtures", fixtureName);
    process.env.CODEX_TIMEOUT_MS = "2000";
    process.env.EVENT_STORE_PATH = storePath;

    try {
        return await callback(storePath);
    } finally {
        if (previousCommand === undefined) {
            delete process.env.CODEX_COMMAND;
        } else {
            process.env.CODEX_COMMAND = previousCommand;
        }

        if (previousStorePath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousStorePath;
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

async function createDraft() {
    return await createFunctionalRequirement({
        actorName: "Carlo",
        source: "Business Plan",
        statement: "User can export evidence.",
        title: "Export evidence"
    });
}

test("a Codex proposal cannot mutate or approve a draft", async function () {
    await withEnvironment("fakeCodex.js", async function (storePath) {
        const created = await createDraft();

        await assert.rejects(proposeFunctionalRequirementAiReview({
            confirmed: false,
            requirementId: created.id
        }), assertCode("CONFIRMATION_REQUIRED"));

        const proposed = await proposeFunctionalRequirementAiReview({
            confirmed: true,
            requirementId: created.id
        });

        assert.equal(proposed.status, "draft");
        assert.equal(proposed.currentVersion, 1);
        assert.equal(proposed.approvedVersion, null);
        assert.equal(proposed.decision, null);
        assert.equal(proposed.versions.length, 1);
        assert.equal(proposed.versions[0].statement, "User can export evidence.");
        assert.equal(proposed.aiReviews.length, 1);
        assert.equal(proposed.aiReviews[0].actor.kind, "ai");
        assert.equal(proposed.aiReviews[0].actor.name, "Codex");

        const suggestion = proposed.aiReviews[0].review.suggestedRevision;
        const revised = await reviseFunctionalRequirement({
            actorName: "Carlo",
            note: "Human applied the Codex proposal.",
            requirementId: created.id,
            statement: suggestion.statement,
            title: suggestion.title
        });

        assert.equal(revised.status, "draft");
        assert.equal(revised.currentVersion, 2);
        assert.equal(revised.approvedVersion, null);
        assert.equal(revised.versions[1].actor.kind, "human");
        assert.equal(revised.versions[1].actor.name, "Carlo");
        assert.equal(revised.aiReviews.length, 1);

        await submitFunctionalRequirementReview({actorName: "Carlo", requirementId: created.id});
        await assert.rejects(proposeFunctionalRequirementAiReview({
            confirmed: true,
            requirementId: created.id
        }), assertCode("INVALID_TRANSITION"));

        const storedText = fs.readFileSync(storePath, "utf8");
        const events = storedText.trim().split("\n").map(JSON.parse);
        const proposalEvent = events.find(function (event) {
            return event.eventType === "ai_review_proposed";
        });

        assert.deepEqual(Object.keys(proposalEvent.payload).sort(), ["review", "version"]);
        assert.equal(storedText.includes("Requirement JSON"), false);
        assert.equal(storedText.includes("input_tokens"), false);
        assert.equal(storedText.includes("reasoning"), false);
    });
});

test("invalid Codex output leaves the event history unchanged", async function () {
    await withEnvironment("fakeCodexMalformed.js", async function (storePath) {
        const created = await createDraft();

        await assert.rejects(proposeFunctionalRequirementAiReview({
            confirmed: true,
            requirementId: created.id
        }), assertCode("CODEX_PROTOCOL_ERROR"));

        const events = fs.readFileSync(storePath, "utf8").trim().split("\n").map(JSON.parse);
        assert.equal(events.length, 1);
        assert.equal(events[0].eventType, "functional_requirement_created");
    });
});

test("the HTTP endpoint requires exact confirmation and returns a proposal", async function () {
    await withEnvironment("fakeCodex.js", async function () {
        const app = createApp();

        try {
            const createResponse = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    source: "Business Plan",
                    statement: "User can export evidence.",
                    title: "Export evidence"
                },
                url: "/api/functional-requirements"
            });
            const requirementId = createResponse.json().id;

            const missingConfirmation = await app.inject({
                method: "POST",
                payload: {},
                url: `/api/functional-requirements/${requirementId}/ai-reviews`
            });
            assert.equal(missingConfirmation.statusCode, 400);
            assert.equal(missingConfirmation.json().code, "INVALID_REQUEST");

            const extraProperty = await app.inject({
                method: "POST",
                payload: {confirmed: true, prompt: "not allowed"},
                url: `/api/functional-requirements/${requirementId}/ai-reviews`
            });
            assert.equal(extraProperty.statusCode, 400);

            const reviewResponse = await app.inject({
                method: "POST",
                payload: {confirmed: true},
                url: `/api/functional-requirements/${requirementId}/ai-reviews`
            });
            assert.equal(reviewResponse.statusCode, 200);
            assert.equal(reviewResponse.json().status, "draft");
            assert.equal(reviewResponse.json().aiReviews.length, 1);
        } finally {
            await app.close();
        }
    });
});
