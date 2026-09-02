"use strict";

const path = require("path");
const process = require("process");

const codex = require(path.resolve(process.cwd(), "src", "drivers", "codex.js"));

module.exports = async function getCodexStatus() {
    return await codex({
        action: "status"
    });
};

