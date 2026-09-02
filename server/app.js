"use strict";

const path = require("path");
const process = require("process");

const fastifyStatic = require("@fastify/static");
const Fastify = require("fastify");

const getCodexStatus = require(path.resolve(process.cwd(), "src", "services", "getCodexStatus.js"));
const getHealth = require(path.resolve(process.cwd(), "src", "services", "getHealth.js"));
const runCodexSmoke = require(path.resolve(process.cwd(), "src", "services", "runCodexSmoke.js"));

function mapErrorStatus(error) {
    const statusByCode = {
        CODEX_CANCELLED: 499,
        CODEX_NOT_READY: 503,
        CODEX_NONZERO_EXIT: 502,
        CODEX_OUTPUT_LIMIT: 502,
        CODEX_PROCESS_ERROR: 502,
        CODEX_PROTOCOL_ERROR: 502,
        CODEX_TIMEOUT: 504,
        CONFIRMATION_REQUIRED: 400
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
        bodyLimit: 1024,
        logger: false
    });

    app.register(fastifyStatic, {
        root: path.resolve(process.cwd(), "public")
    });

    app.get("/", async function (_request, reply) {
        return await reply.sendFile("index.html");
    });

    app.get("/health", async function () {
        return await getHealth();
    });

    app.get("/api/providers/codex", async function () {
        return await getCodexStatus();
    });

    app.post("/api/providers/codex/smoke", {
        schema: {
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
            CODEX_NONZERO_EXIT: "Codex smoke test failed.",
            CODEX_OUTPUT_LIMIT: "Codex output exceeded the allowed size.",
            CODEX_PROCESS_ERROR: "Codex CLI could not be started.",
            CODEX_PROTOCOL_ERROR: "Codex returned an invalid response.",
            CODEX_TIMEOUT: "Codex execution timed out.",
            CONFIRMATION_REQUIRED: "Explicit confirmation is required.",
            INTERNAL_ERROR: "An internal error occurred.",
            INVALID_REQUEST: "The request is invalid."
        };

        return reply.code(statusCode).send({
            code,
            message: safeMessages[code] || safeMessages.INTERNAL_ERROR,
            status: "error"
        });
    });

    return app;
};
