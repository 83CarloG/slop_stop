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
const createTask = require(path.resolve(process.cwd(), "src", "services", "createTask.js"));
const createTaskExecutionCandidate = require(path.resolve(process.cwd(), "src", "services", "createTaskExecutionCandidate.js"));
const createTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "createTechnicalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTask = require(path.resolve(process.cwd(), "src", "services", "decideTask.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const evaluateTaskReadiness = require(path.resolve(process.cwd(), "src", "services", "evaluateTaskReadiness.js"));
const getCodexStatus = require(path.resolve(process.cwd(), "src", "services", "getCodexStatus.js"));
const getFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "getFunctionalRequirement.js"));
const getHealth = require(path.resolve(process.cwd(), "src", "services", "getHealth.js"));
const getTask = require(path.resolve(process.cwd(), "src", "services", "getTask.js"));
const getTaskExecutionPatch = require(path.resolve(process.cwd(), "src", "services", "getTaskExecutionPatch.js"));
const getTaskTrace = require(path.resolve(process.cwd(), "src", "services", "getTaskTrace.js"));
const getTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "getTechnicalRequirement.js"));
const listFunctionalRequirements = require(path.resolve(process.cwd(), "src", "services", "listFunctionalRequirements.js"));
const listTasks = require(path.resolve(process.cwd(), "src", "services", "listTasks.js"));
const listTechnicalRequirements = require(path.resolve(process.cwd(), "src", "services", "listTechnicalRequirements.js"));
const proposeFunctionalRequirementAiReview = require(path.resolve(process.cwd(), "src", "services", "proposeFunctionalRequirementAiReview.js"));
const proposeTaskExecution = require(path.resolve(process.cwd(), "src", "services", "proposeTaskExecution.js"));
const reviseFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseFunctionalRequirement.js"));
const reviseTask = require(path.resolve(process.cwd(), "src", "services", "reviseTask.js"));
const reviseTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "reviseTechnicalRequirement.js"));
const runCodexSmoke = require(path.resolve(process.cwd(), "src", "services", "runCodexSmoke.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTaskReview = require(path.resolve(process.cwd(), "src", "services", "submitTaskReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

const actorNameSchema = {maxLength: 80, minLength: 1, type: "string"};
const noteSchema = {maxLength: 500, minLength: 1, type: "string"};
const acceptanceCriteriaSchema = {
    items: {maxLength: 500, minLength: 1, type: "string"},
    maxItems: 10,
    minItems: 1,
    type: "array"
};
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
const taskIdSchema = {
    properties: {
        taskId: {
            format: "uuid",
            type: "string"
        }
    },
    required: ["taskId"],
    type: "object"
};
const taskExecutionIdSchema = {
    properties: {
        executionId: {format: "uuid", type: "string"},
        taskId: {format: "uuid", type: "string"}
    },
    required: ["executionId", "taskId"],
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
        EXECUTION_NOT_FOUND: 404,
        FUNCTIONAL_REQUIREMENT_NOT_APPROVED: 409,
        FUNCTIONAL_REQUIREMENT_NOT_FOUND: 404,
        INVALID_REQUEST: 400,
        INVALID_TASK_TRANSITION: 409,
        INVALID_TECHNICAL_TRANSITION: 409,
        INVALID_TRANSITION: 409,
        REQUIREMENT_NOT_FOUND: 404,
        STORE_CORRUPTED: 500,
        PATCH_CORRUPTED: 500,
        PATCH_NOT_FOUND: 404,
        TASK_NOT_FOUND: 404,
        TASK_EXECUTION_NOT_READY: 409,
        TASK_NOT_READY: 409,
        TECHNICAL_REQUIREMENT_NOT_APPROVED: 409,
        TECHNICAL_REQUIREMENT_NOT_FOUND: 404,
        WORKSPACE_EMPTY_RESULT: 422,
        WORKSPACE_GIT_ERROR: 502,
        WORKSPACE_OUTPUT_LIMIT: 502,
        WORKSPACE_SOURCE_INVALID: 500,
        WORKSPACE_UNSAFE_RESULT: 502
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

    app.post("/api/tasks", {
        schema: {
            operationId: "createTask",
            summary: "Create a task draft from an approved technical origin",
            tags: ["Tasks"],
            body: {
                additionalProperties: false,
                properties: {
                    acceptanceCriteria: acceptanceCriteriaSchema,
                    actorName: actorNameSchema,
                    objective: {maxLength: 2000, minLength: 1, type: "string"},
                    technicalRequirementId: {format: "uuid", type: "string"},
                    title: {maxLength: 120, minLength: 1, type: "string"}
                },
                required: ["acceptanceCriteria", "actorName", "objective", "technicalRequirementId", "title"],
                type: "object"
            }
        }
    }, async function (request, reply) {
        const task = await createTask(request.body);
        return reply.code(201).send(task);
    });

    app.get("/api/tasks", {
        schema: {
            operationId: "listTasks",
            summary: "List task drafts and optionally filter by technical origin",
            tags: ["Tasks"],
            querystring: {
                additionalProperties: false,
                properties: {
                    technicalRequirementId: {format: "uuid", type: "string"}
                },
                type: "object"
            }
        }
    }, async function (request) {
        return await listTasks({
            technicalRequirementId: request.query.technicalRequirementId
        });
    });

    app.get("/api/tasks/:taskId", {
        schema: {
            operationId: "getTask",
            params: taskIdSchema,
            summary: "Get one task draft with its technical origin",
            tags: ["Tasks"]
        }
    }, async function (request) {
        return await getTask({taskId: request.params.taskId});
    });

    app.get("/api/tasks/:taskId/trace", {
        schema: {
            operationId: "getTaskTrace",
            params: taskIdSchema,
            summary: "Get the normalized process trace for one task",
            tags: ["Tasks"]
        }
    }, async function (request) {
        return await getTaskTrace({taskId: request.params.taskId});
    });

    app.post("/api/tasks/:taskId/revisions", {
        schema: {
            operationId: "reviseTask",
            summary: "Create an immutable task draft revision",
            tags: ["Tasks"],
            body: {
                additionalProperties: false,
                properties: {
                    acceptanceCriteria: acceptanceCriteriaSchema,
                    actorName: actorNameSchema,
                    note: noteSchema,
                    objective: {maxLength: 2000, minLength: 1, type: "string"},
                    title: {maxLength: 120, minLength: 1, type: "string"}
                },
                required: ["acceptanceCriteria", "actorName", "note", "objective", "title"],
                type: "object"
            },
            params: taskIdSchema
        }
    }, async function (request, reply) {
        const task = await reviseTask({...request.body, taskId: request.params.taskId});
        return reply.code(201).send(task);
    });

    app.post("/api/tasks/:taskId/review", {
        schema: {
            operationId: "submitTaskReview",
            summary: "Submit a task draft for human review",
            tags: ["Tasks"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema
                },
                required: ["actorName"],
                type: "object"
            },
            params: taskIdSchema
        }
    }, async function (request) {
        return await submitTaskReview({
            actorName: request.body.actorName,
            taskId: request.params.taskId
        });
    });

    app.post("/api/tasks/:taskId/decisions", {
        schema: {
            operationId: "decideTask",
            summary: "Approve or reject a reviewed task",
            tags: ["Tasks"],
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
            params: taskIdSchema
        }
    }, async function (request) {
        return await decideTask({
            ...request.body,
            taskId: request.params.taskId
        });
    });

    app.post("/api/tasks/:taskId/checks", {
        schema: {
            operationId: "evaluateTaskReadiness",
            summary: "Evaluate the approved task derivation chain",
            tags: ["Tasks"],
            body: {
                additionalProperties: false,
                properties: {},
                type: "object"
            },
            params: taskIdSchema
        }
    }, async function (request) {
        return await evaluateTaskReadiness({taskId: request.params.taskId});
    });

    app.post("/api/tasks/:taskId/execution-proposals", {
        schema: {
            operationId: "proposeTaskExecution",
            summary: "Request a read-only Codex execution proposal for a ready task",
            tags: ["Tasks", "Codex"],
            body: {
                additionalProperties: false,
                properties: {
                    confirmed: {const: true}
                },
                required: ["confirmed"],
                type: "object"
            },
            params: taskIdSchema
        }
    }, async function (request) {
        return await proposeTaskExecution({
            confirmed: request.body.confirmed,
            signal: request.raw.signal,
            taskId: request.params.taskId
        });
    });

    app.post("/api/tasks/:taskId/executions", {
        schema: {
            operationId: "createTaskExecutionCandidate",
            summary: "Create an isolated implementation candidate from the latest task proposal",
            tags: ["Tasks", "Codex"],
            body: {
                additionalProperties: false,
                properties: {
                    actorName: actorNameSchema,
                    confirmed: {const: true},
                    note: noteSchema
                },
                required: ["actorName", "confirmed", "note"],
                type: "object"
            },
            params: taskIdSchema
        }
    }, async function (request) {
        return await createTaskExecutionCandidate({
            ...request.body,
            signal: request.raw.signal,
            taskId: request.params.taskId
        });
    });

    app.get("/api/tasks/:taskId/executions/:executionId/patch", {
        schema: {
            operationId: "getTaskExecutionPatch",
            summary: "Read an integrity-checked implementation candidate patch",
            tags: ["Tasks"],
            params: taskExecutionIdSchema,
            response: {
                200: {type: "string"}
            }
        }
    }, async function (request, reply) {
        const result = await getTaskExecutionPatch(request.params);

        return await reply
            .header("etag", `\"${result.patchSha256}\"`)
            .type("text/x-diff; charset=utf-8")
            .send(result.content);
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
            EXECUTION_NOT_FOUND: "The task execution candidate was not found.",
            FUNCTIONAL_REQUIREMENT_NOT_APPROVED: "The originating functional requirement is not approved.",
            FUNCTIONAL_REQUIREMENT_NOT_FOUND: "The originating functional requirement was not found.",
            INTERNAL_ERROR: "An internal error occurred.",
            INVALID_REQUEST: "The request is invalid.",
            INVALID_TASK_TRANSITION: "The task transition is not allowed.",
            INVALID_TECHNICAL_TRANSITION: "The technical requirement transition is not allowed.",
            INVALID_TRANSITION: "The functional requirement transition is not allowed.",
            REQUIREMENT_NOT_FOUND: "The functional requirement was not found.",
            PATCH_CORRUPTED: "The patch artifact failed its integrity check.",
            PATCH_NOT_FOUND: "The patch artifact was not found.",
            STORE_CORRUPTED: "The local event store is corrupted.",
            TASK_EXECUTION_NOT_READY: "The task is not ready for isolated execution.",
            TASK_NOT_FOUND: "The task was not found.",
            TECHNICAL_REQUIREMENT_NOT_APPROVED: "The originating technical requirement is not approved.",
            TECHNICAL_REQUIREMENT_NOT_FOUND: "The technical requirement was not found.",
            WORKSPACE_EMPTY_RESULT: "Codex did not produce a candidate change.",
            WORKSPACE_GIT_ERROR: "The isolated Git workspace operation failed.",
            WORKSPACE_OUTPUT_LIMIT: "The isolated candidate exceeded the allowed size.",
            WORKSPACE_SOURCE_INVALID: "The application root is not a valid execution source.",
            WORKSPACE_UNSAFE_RESULT: "The isolated candidate contains unsafe changes."
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
