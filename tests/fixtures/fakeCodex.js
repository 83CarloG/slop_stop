"use strict";

const process = require("process");

const argumentsList = process.argv.slice(2);

if (argumentsList[0] === "--version") {
    process.stdout.write("codex-cli 0.test.0\n");
} else if (argumentsList[0] === "login" && argumentsList[1] === "status") {
    process.stdout.write("Authenticated\n");
} else if (argumentsList[0] === "exec") {
    let input = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("data", function (chunk) {
        input += chunk;
    });
    process.stdin.on("end", function () {
        const promptLeakedToArguments = argumentsList.some(function (argument) {
            return argument.includes("readiness response");
        });

        if (promptLeakedToArguments || !input.includes("readiness response")) {
            process.exitCode = 2;
            return;
        }

        const message = process.env.OPENAI_API_KEY ? "Secret leaked." : "Secrets are isolated.";
        const event = JSON.stringify({
            item: {
                text: JSON.stringify({
                    message,
                    status: "ready"
                }),
                type: "agent_message"
            },
            type: "item.completed"
        });
        const usage = JSON.stringify({
            type: "turn.completed",
            usage: {
                input_tokens: 1,
                output_tokens: 1
            }
        });

        process.stdout.write(`${event}\n${usage}\n`);
    });
} else {
    process.exitCode = 2;
}

