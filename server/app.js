"use strict";

const crypto = require("crypto");
const path = require("path");
const process = require("process");

const fastifyStatic = require("@fastify/static");
const fastifySwagger = require("@fastify/swagger");
const fastifySwaggerUi = require("@fastify/swagger-ui");
const Fastify = require("fastify");

const getOpenApiConfig = require(path.resolve(process.cwd(), "config", "openapi.js"));

const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const createTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "createTechnicalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const getCodexStatus = require(path.resolve(process.cwd(), "src", "services", "getCodexStatus.js"));
const getFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "getFunctionalRequirement.js"));
const getHealth = require(path.resolve(process.cwd(), "src", "services", "getHealth.js"));
const getTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "getTechnicalRequirement.js"));
const listFunctionalRequirements = require(path.resolve(process.cwd(), "src", "services", "listFunctionalRequirements.js"));
const listTechnicalRequirements = require(path.resolve(process.cwd(), "src", "services", "listTechnicalRequirements.js"));
const proposeFunctionalRequirementAiReview = require(path.resolve(process.cwd(), "src", "services", "proposeFunctionalRequirementAiReview.js"));
const reviseFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseFunctionalRequirement.js"));
const reviseTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseTechnicalRequirement.js"));
const runCodexSmoke = require(path.resolve(process.cwd(), "src", "services", "runCodexSmoke.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

const actorNameSchema = {maxLength: 80, minLength: 1, type: "string"};
const noteSchema = {maxLength: 500, minLength: 1, type: "string"};
const requirementIdSchema = {
    properties: {
        requirementId: {
            pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            type: "string"
        }
    },
    required: ["requirementId"],
    type: "object"
};

function mapErrorStatus(error) {
    const statusByCode = {
        CODEX_CANCELLED: 499,
        CODEX_NOT_READY: 503,
        CODEX_NONZERO_EXIT: 502,
        CODEX_OUTPUT_LIMIT: 502,
        CODEX_PROCESS_ERROR: 502,
        CODEX_PROTOCOL_ERROR: 502,
        CODEX_TIMEOUT: 504,
        CONFIRMATION_REQUIRED: 400,
        FUNCTIONAL_REQUIREMENT_NOT_APPROVED: 409,
        FUNCTIONAL_REQUIREMENT_NOT_FOUND: 404,
        INVALID_REQUEST: 400,
        INVALID_TECHNICAL_TRANSITION: 409,
        INVALID_TRANSITION: 409,
        REQUIREMENT_NOT_FOUND: 404,
        STORE_CORRUPTED: 500,
        TECHNICAL_REQUIREMENT_NOT_FOUND: 404
    };

    return statusByCode[error.code] || 500;
}

module.exports = function createApp() {
    const app = Fastify({
        ajv: {
            customOptions: {
                removeAdditional: false
            }
        },
        bodyLimit: 8192,
        genReqId: function () {
            return crypto.randomUUID();
        },
        logger: false
    });

    app.register(fastifySwagger, getOpenApiConfig());
    app.register(fastifySwaggerUi, {
        routePrefix: "/documentation",
        staticCSP: true,
        uiConfig: {
            deepLinking: true,
            displayRequestDuration: true
        }
    });

    app.register(function registerApplicationRoutes(app, _options, done) {
        app.addHook("onRequest", async function (request, reply) {
            reply.header("x-request-id", request.id);
        });

    app.register(fastifyStatic, {
        root: path.resolve(process.cwd(), "public")
    });

    app.get("/", async function (_request, reply) {
        return await reply.sendFile("index.html");
    });

    app.get("/health", {
        schema: {
            operationId: "getHealth",
            summary: "Get application readiness",
            tags: ["System"]
        }
    }, async function () {
        return await getHealth();
    });

    app.get("/api/providers/codex", {
        schema: {
            operationId: "getCodexStatus",
            summary: "Get Codex CLI readiness",
            tags: ["Codex"]
        }
    }, async function () {
        return await getCodexStatus();
    });

    app.post("/api/functional-requirements", {
        schema: {
            operationId: "createFunctionalRequirement",
            summary: "Create a functional requirement draft",
            tags: ["Functional requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    source: {maxLength: 500, minLength: 1, type: "string"},
                    statement: {maxLength: 4000, minLength: 1, type: "string"},
                    title: {maxLength: 120, minLength: 1, type: "string"}
                },
                required: ["actorName", "source", "statement", "title"],
                type: "object"
            }
        }
    }, async function (request, reply) {
        const requirement = await createFunctionalRequirement(request.body);
        return reply.code(201).send(requirement);
    });

    app.get("/api/functional-requirements", {
        schema: {
            operationId: "listFunctionalRequirements",
            summary: "List functional requirements",
            tags: ["Functional requirements"]
        }
    }, async function () {
        return await listFunctionalRequirements();
    });

    app.get("/api/functional-requirements/:requirementId", {
        schema: {
            operationId: "getFunctionalRequirement",
            params: requirementIdSchema,
            summary: "Get one functional requirement",
            tags: ["Functional requirements"]
        }
    }, async function (request) {
        return await getFunctionalRequirement({
            requirementId: request.params.requirementId
        });
    });

    app.post("/api/functional-requirements/:requirementId/revisions", {
        schema: {
            operationId: "reviseFunctionalRequirement",
            summary: "Create an immutable requirement revision",
            tags: ["Functional requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    note: noteSchema,
                    statement: {maxLength: 4000, minLength: 1, type: "string"},
                    title: {maxLength: 120, minLength: 1, type: "string"}
                },
                required: ["actorName", "note", "statement", "title"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request, reply) {
        const requirement = await reviseFunctionalRequirement({
            ...request.body,
            requirementId: request.params.requirementId
        });
        return reply.code(201).send(requirement);
    });

    app.post("/api/functional-requirements/:requirementId/review", {
        schema: {
            operationId: "submitFunctionalRequirementReview",
            summary: "Submit a draft for human review",
            tags: ["Functional requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema
                },
                required: ["actorName"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request) {
        return await submitFunctionalRequirementReview({
            actorName: request.body.actorName,
            requirementId: request.params.requirementId
        });
    });

    app.post("/api/functional-requirements/:requirementId/decisions", {
        schema: {
            operationId: "decideFunctionalRequirement",
            summary: "Approve or reject a reviewed requirement",
            tags: ["Functional requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    decision: {enum: ["approved", "rejected"], type: "string"},
                    note: noteSchema
                },
                required: ["actorName", "decision", "note"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request) {
        return await decideFunctionalRequirement({
            ...request.body,
            requirementId: request.params.requirementId
        });
    });

    app.post("/api/functional-requirements/:requirementId/ai-reviews", {
        schema: {
            operationId: "proposeFunctionalRequirementAiReview",
            summary: "Record an explicitly confirmed Codex review proposal",
            tags: ["Codex", "Functional requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    confirmed: {const: true}
                },
                required: ["confirmed"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request) {
        return await proposeFunctionalRequirementAiReview({
            confirmed: request.body.confirmed,
            requirementId: request.params.requirementId,
            signal: request.raw.signal
        });
    });

    app.post("/api/technical-requirements", {
        schema: {
            operationId: "createTechnicalRequirement",
            summary: "Create a technical requirement from an approved functional origin",
            tags: ["Technical requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    functionalRequirementId: {
                        format: "uuid",
                        type: "string"
                    },
                    statement: {maxLength: 4000, minLength: 1, type: "string"},
                    title: {maxLength: 120, minLength: 1, type: "string"}
                },
                required: ["actorName", "functionalRequirementId", "statement", "title"],
                type: "object"
            }
        }
    }, async function (request, reply) {
        const requirement = await createTechnicalRequirement(request.body);
        return reply.code(201).send(requirement);
    });

    app.get("/api/technical-requirements", {
        schema: {
            operationId: "listTechnicalRequirements",
            summary: "List technical requirements and optionally filter by functional origin",
            tags: ["Technical requirements"],
            querystring: {
                additionalProperties: false,
                properties: {
                    functionalRequirementId: {
                        format: "uuid",
                        type: "string"
                    }
                },
                type: "object"
            }
        }
    }, async function (request) {
        return await listTechnicalRequirements({
            functionalRequirementId: request.query.functionalRequirementId
        });
    });

    app.get("/api/technical-requirements/:requirementId", {
        schema: {
            operationId: "getTechnicalRequirement",
            params: requirementIdSchema,
            summary: "Get one technical requirement with its functional origin",
            tags: ["Technical requirements"]
        }
    }, async function (request) {
        return await getTechnicalRequirement({
            requirementId: request.params.requirementId
        });
    });

    app.post("/api/technical-requirements/:requirementId/revisions", {
        schema: {
            operationId: "reviseTechnicalRequirement",
            summary: "Create an immutable technical requirement revision",
            tags: ["Technical requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    note: noteSchema,
                    statement: {maxLength: 4000, minLength: 1, type: "string"},
                    title: {maxLength: 120, minLength: 1, type: "string"}
                },
                required: ["actorName", "note", "statement", "title"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request, reply) {
        const requirement = await reviseTechnicalRequirement({
            ...request.body,
            requirementId: request.params.requirementId
        });
        return reply.code(201).send(requirement);
    });

    app.post("/api/technical-requirements/:requirementId/review", {
        schema: {
            operationId: "submitTechnicalRequirementReview",
            summary: "Submit a technical requirement draft for human review",
            tags: ["Technical requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema
                },
                required: ["actorName"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request) {
        return await submitTechnicalRequirementReview({
            actorName: request.body.actorName,
            requirementId: request.params.requirementId
        });
    });

    app.post("/api/technical-requirements/:requirementId/decisions", {
        schema: {
            operationId: "decideTechnicalRequirement",
            summary: "Approve or reject a reviewed technical requirement",
            tags: ["Technical requirements"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    decision: {enum: ["approved", "rejected"], type: "string"},
                    note: noteSchema
                },
                required: ["actorName", "decision", "note"],
                type: "object"
            },
            params: requirementIdSchema
        }
    }, async function (request) {
        return await decideTechnicalRequirement({
            ...request.body,
            requirementId: request.params.requirementId
        });
    });

    app.post("/api/providers/codex/smoke", {
        schema: {
            operationId: "runCodexSmoke",
            summary: "Run an explicitly confirmed Codex connectivity check",
            tags: ["Codex"],
            body: {
                additionalProperties: false,
                properties: {
                    confirmed: {const: true}
                },
                required: ["confirmed"],
                type: "object"
            }
        }
    }, async function (request) {
        return await runCodexSmoke({
            confirmed: request.body.confirmed,
            signal: request.raw.signal
        });
    });

        app.setErrorHandler(function (error, _request, reply) {
        const statusCode = error.validation ? 400 : mapErrorStatus(error);
        const code = error.validation ? "INVALID_REQUEST" : (error.code || "INTERNAL_ERROR");
        const safeMessages = {
            CODEX_CANCELLED: "Codex execution was cancelled.",
            CODEX_NOT_READY: "Codex CLI is not available and authenticated.",
            CODEX_NONZERO_EXIT: "Codex request failed.",
            CODEX_OUTPUT_LIMIT: "Codex output exceeded the allowed size.",
            CODEX_PROCESS_ERROR: "Codex CLI could not be started.",
            CODEX_PROTOCOL_ERROR: "Codex returned an invalid response.",
            CODEX_TIMEOUT: "Codex execution timed out.",
            CONFIRMATION_REQUIRED: "Explicit confirmation is required.",
            FUNCTIONAL_REQUIREMENT_NOT_APPROVED: "The originating functional requirement is not approved.",
            FUNCTIONAL_REQUIREMENT_NOT_FOUND: "The originating functional requirement was not found.",
            INTERNAL_ERROR: "An internal error occurred.",
            INVALID_REQUEST: "The request is invalid.",
            INVALID_TECHNICAL_TRANSITION: "The technical requirement transition is not allowed.",
            INVALID_TRANSITION: "The functional requirement transition is not allowed.",
            REQUIREMENT_NOT_FOUND: "The functional requirement was not found.",
            STORE_CORRUPTED: "The local event store is corrupted.",
            TECHNICAL_REQUIREMENT_NOT_FOUND: "The technical requirement was not found."
        };

        return reply.code(statusCode).send({
            code,
            message: safeMessages[code] || safeMessages.INTERNAL_ERROR,
            status: "error"
        });
        });

        done();
    });

    return app;
};
