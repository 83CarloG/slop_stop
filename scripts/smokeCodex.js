"use strict";

const path = require("path");
const process = require("process");

const runCodexSmoke = require(path.resolve(process.cwd(), "src", "services", "runCodexSmoke.js"));

async function main() {
    try {
        const result = await runCodexSmoke({confirmed: true});
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
        process.stderr.write(`${JSON.stringify({
            code: error.code || "INTERNAL_ERROR",
            message: error.message,
            status: "error"
        }, null, 2)}\n`);
        process.exitCode = 1;
    }
}

main();

