"use strict";

const path = require("path");
const process = require("process");

const codex = require(path.resolve(process.cwd(), "src", "drivers", "codex.js"));

module.exports = async function runCodexSmoke(input) {
    if (!input || input.confirmed !== true) {
        const error = new Error("Explicit confirmation is required.");
        error.code = "CONFIRMATION_REQUIRED";
        throw error;
    }

    return await codex({
        action: "smoke",
        signal: input.signal
    });
};

