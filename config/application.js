"use strict";

const path = require("path");
const process = require("process");

function parsePositiveInteger(value, fallback, variableName) {
    if (value === undefined || value === "") {
        return fallback;
    }

    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error(`${variableName} must be a positive integer.`);
    }

    return parsedValue;
}

module.exports = function getApplicationConfig() {
    const codexCommand = process.env.CODEX_COMMAND || "codex";

    if (path.isAbsolute(codexCommand) === false && /^[A-Za-z0-9._-]+$/.test(codexCommand) === false) {
        throw new Error("CODEX_COMMAND must be a command name or an absolute path.");
    }

    return {
        appHost: process.env.APP_HOST || "127.0.0.1",
        appPort: parsePositiveInteger(process.env.APP_PORT, 3000, "APP_PORT"),
        codexCommand,
        codexHome: process.env.CODEX_HOME || null,
        codexModel: process.env.CODEX_MODEL || null,
        codexTimeoutMs: parsePositiveInteger(process.env.CODEX_TIMEOUT_MS, 120000, "CODEX_TIMEOUT_MS"),
        eventStorePath: path.resolve(process.cwd(), process.env.EVENT_STORE_PATH || ".data/events.jsonl")
    };
};
