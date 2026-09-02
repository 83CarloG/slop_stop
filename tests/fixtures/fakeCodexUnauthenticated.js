"use strict";

const process = require("process");

const argumentsList = process.argv.slice(2);

if (argumentsList[0] === "--version") {
    process.stdout.write("codex-cli 0.test.0\n");
} else if (argumentsList[0] === "login" && argumentsList[1] === "status") {
    process.exitCode = 1;
} else {
    process.exitCode = 2;
}

