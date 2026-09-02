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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-http-"));
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

test("the HTTP lifecycle persists across application instances", async function () {
    await withEventStore(async function () {
        let app = createApp();
        let requirementId;

        try {
            const invalidResponse = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    extra: "not allowed",
                    source: "Business Plan",
                    statement: "Invalid payload.",
                    title: "Invalid"
                },
                url: "/api/functional-requirements"
            });
            assert.equal(invalidResponse.statusCode, 400);
            assert.equal(invalidResponse.json().code, "INVALID_REQUEST");

            const createResponse = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    source: "Short Business Plan, Product section",
                    statement: "A human can approve a reviewed functional requirement.",
                    title: "Approve a requirement"
                },
                url: "/api/functional-requirements"
            });
            assert.equal(createResponse.statusCode, 201);
            requirementId = createResponse.json().id;

            const listResponse = await app.inject({method: "GET", url: "/api/functional-requirements"});
            assert.equal(listResponse.statusCode, 200);
            assert.equal(listResponse.json().items.length, 1);

            const missingNoteResponse = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    statement: "A revised statement without evidence.",
                    title: "Missing revision note"
                },
                url: `/api/functional-requirements/${requirementId}/revisions`
            });
            assert.equal(missingNoteResponse.statusCode, 400);
            assert.equal(missingNoteResponse.json().code, "INVALID_REQUEST");

            const revisionResponse = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    note: "Clarified the review boundary.",
                    statement: "A human can approve a functional requirement only after review.",
                    title: "Approve only after review"
                },
                url: `/api/functional-requirements/${requirementId}/revisions`
            });
            assert.equal(revisionResponse.statusCode, 201);
            assert.equal(revisionResponse.json().currentVersion, 2);

            const prematureDecision = await app.inject({
                method: "POST",
                payload: {actorName: "Carlo", decision: "approved", note: "Too early."},
                url: `/api/functional-requirements/${requirementId}/decisions`
            });
            assert.equal(prematureDecision.statusCode, 409);
            assert.equal(prematureDecision.json().code, "INVALID_TRANSITION");

            const reviewResponse = await app.inject({
                method: "POST",
                payload: {actorName: "Carlo"},
                url: `/api/functional-requirements/${requirementId}/review`
            });
            assert.equal(reviewResponse.statusCode, 200);
            assert.equal(reviewResponse.json().status, "in_review");

            const decisionResponse = await app.inject({
                method: "POST",
                payload: {actorName: "Carlo", decision: "approved", note: "Approved after review."},
                url: `/api/functional-requirements/${requirementId}/decisions`
            });
            assert.equal(decisionResponse.statusCode, 200);
            assert.equal(decisionResponse.json().status, "approved");
        } finally {
            await app.close();
        }

        app = createApp();

        try {
            const persistedResponse = await app.inject({
                method: "GET",
                url: `/api/functional-requirements/${requirementId}`
            });
            assert.equal(persistedResponse.statusCode, 200);
            assert.equal(persistedResponse.json().decision.actor.name, "Carlo");

            const missingResponse = await app.inject({
                method: "GET",
                url: `/api/functional-requirements/${crypto.randomUUID()}`
            });
            assert.equal(missingResponse.statusCode, 404);
            assert.equal(missingResponse.json().code, "REQUIREMENT_NOT_FOUND");
        } finally {
            await app.close();
        }
    });
});
