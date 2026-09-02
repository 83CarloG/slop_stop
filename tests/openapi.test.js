"use strict";

const assert = require("assert");
const path = require("path");
const process = require("process");
const test = require("node:test");

const createApp = require(path.resolve(process.cwd(), "server", "app.js"));

const expectedOperations = [
    "createFunctionalRequirement",
    "createTechnicalRequirement",
    "decideFunctionalRequirement",
    "decideTechnicalRequirement",
    "getCodexStatus",
    "getFunctionalRequirement",
    "getHealth",
    "getTechnicalRequirement",
    "listFunctionalRequirements",
    "listTechnicalRequirements",
    "proposeFunctionalRequirementAiReview",
    "reviseFunctionalRequirement",
    "reviseTechnicalRequirement",
    "runCodexSmoke",
    "submitFunctionalRequirementReview",
    "submitTechnicalRequirementReview"
];

test("the generated OpenAPI contract documents every API operation", async function () {
    const app = createApp();

    try {
        const response = await app.inject({method: "GET", url: "/documentation/json"});
        const contract = response.json();
        const operations = [];

        assert.equal(response.statusCode, 200);
        assert.equal(contract.openapi, "3.0.3");
        assert.equal(contract.info.title, "Slop Stop API");
        assert.equal(contract.paths["/"], undefined);

        for (const pathItem of Object.values(contract.paths)) {
            for (const [method, operation] of Object.entries(pathItem)) {
                if (!["delete", "get", "patch", "post", "put"].includes(method)) {
                    continue;
                }

                operations.push(operation.operationId);
                assert.ok(operation.tags.length > 0);
                assert.ok(operation.summary.length > 0);

                for (const documentedResponse of Object.values(operation.responses)) {
                    assert.equal(
                        documentedResponse.headers["X-Request-Id"].$ref,
                        "#/components/headers/RequestId"
                    );
                }
            }
        }

        assert.deepEqual(operations.sort(), expectedOperations);
        assert.equal(new Set(operations).size, operations.length);
        assert.ok(contract.paths["/api/functional-requirements/{requirementId}/ai-reviews"]);
        assert.ok(contract.paths["/api/technical-requirements/{requirementId}/decisions"]);
    } finally {
        await app.close();
    }
});

test("the explorer is available and responses carry a request id", async function () {
    const app = createApp();

    try {
        const explorerResponse = await app.inject({method: "GET", url: "/documentation/"});
        assert.equal(explorerResponse.statusCode, 200);
        assert.match(explorerResponse.headers["content-type"], /^text\/html/u);

        const healthResponse = await app.inject({method: "GET", url: "/health"});
        assert.equal(healthResponse.statusCode, 200);
        assert.match(
            healthResponse.headers["x-request-id"],
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
        );
    } finally {
        await app.close();
    }
});
