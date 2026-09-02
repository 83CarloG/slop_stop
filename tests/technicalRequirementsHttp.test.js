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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "slop-stop-technical-http-"));
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

test("the HTTP contract preserves technical-to-functional traceability", async function () {
    await withEventStore(async function () {
        let app = createApp();
        let functionalRequirementId;
        let technicalRequirementId;

        try {
            const functionalCreate = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    source: "Business Plan, Traceability section",
                    statement: "A reviewer can trace technical work to the originating functional need.",
                    title: "Trace technical work"
                },
                url: "/api/functional-requirements"
            });
            functionalRequirementId = functionalCreate.json().id;

            const prematureTechnicalCreate = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    functionalRequirementId,
                    statement: "This derivation is premature.",
                    title: "Premature derivation"
                },
                url: "/api/technical-requirements"
            });
            assert.equal(prematureTechnicalCreate.statusCode, 409);
            assert.equal(prematureTechnicalCreate.json().code, "FUNCTIONAL_REQUIREMENT_NOT_APPROVED");

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
                    statement: "Store the functional identifier and approved version on technical creation.",
                    title: "Persist the derivation link"
                },
                url: "/api/technical-requirements"
            });
            assert.equal(technicalCreate.statusCode, 201);
            technicalRequirementId = technicalCreate.json().id;
            assert.equal(technicalCreate.json().functionalRequirementId, functionalRequirementId);
            assert.equal(technicalCreate.json().functionalRequirementVersion, 1);

            const filteredList = await app.inject({
                method: "GET",
                url: `/api/technical-requirements?functionalRequirementId=${functionalRequirementId}`
            });
            assert.equal(filteredList.statusCode, 200);
            assert.equal(filteredList.json().items.length, 1);

            const revision = await app.inject({
                method: "POST",
                payload: {
                    actorName: "Carlo",
                    note: "Clarified the persistence point.",
                    statement: "Store the immutable functional identifier and approved version in the creation event.",
                    title: "Persist immutable derivation"
                },
                url: `/api/technical-requirements/${technicalRequirementId}/revisions`
            });
            assert.equal(revision.statusCode, 201);
            assert.equal(revision.json().currentVersion, 2);

            await app.inject({
                method: "POST",
                payload: {actorName: "Carlo"},
                url: `/api/technical-requirements/${technicalRequirementId}/review`
            });
            const decision = await app.inject({
                method: "POST",
                payload: {actorName: "Carlo", decision: "approved", note: "Traceability is explicit."},
                url: `/api/technical-requirements/${technicalRequirementId}/decisions`
            });
            assert.equal(decision.statusCode, 200);
            assert.equal(decision.json().status, "approved");
        } finally {
            await app.close();
        }

        app = createApp();

        try {
            const persisted = await app.inject({
                method: "GET",
                url: `/api/technical-requirements/${technicalRequirementId}`
            });
            assert.equal(persisted.statusCode, 200);
            assert.equal(persisted.json().functionalRequirementId, functionalRequirementId);
            assert.equal(persisted.json().functionalRequirementVersion, 1);
            assert.equal(persisted.json().versions.length, 2);

            const missing = await app.inject({
                method: "GET",
                url: `/api/technical-requirements/${crypto.randomUUID()}`
            });
            assert.equal(missing.statusCode, 404);
            assert.equal(missing.json().code, "TECHNICAL_REQUIREMENT_NOT_FOUND");
        } finally {
            await app.close();
        }
    });
});

