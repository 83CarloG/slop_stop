"use strict";

const process = require("process");

const argumentsList = process.argv.slice(2);

if (argumentsList[0] === "--version") {
    process.stdout.write("codex-cli 0.test.0\n");
} else if (argumentsList[0] === "login" && argumentsList[1] === "status") {
    process.stdout.write("Authenticated\n");
} else if (argumentsList[0] === "exec") {
    process.stdin.resume();
    process.stdin.on("end", function () {
        process.stdout.write("private malformed output that must not reach the API\n");
    });
} else {
    process.exitCode = 2;
}

