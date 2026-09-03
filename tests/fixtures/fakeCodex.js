"use strict";

const fs = require("fs");
const path = require("path");
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
            return argument.includes("readiness response") ||
                argument.includes("functional requirement") ||
                argument.includes("approved task") ||
                argument.includes("disposable Git workspace");
        });

        const isRequirementReview = input.includes("Review one functional requirement");
        const isTaskExecutionProposal = input.includes("Propose an implementation approach for one approved task");
        const isTaskExecution = input.includes("Implement one approved task in the current disposable Git workspace");

        if (promptLeakedToArguments || ((isRequirementReview || isTaskExecution) && process.env.OPENAI_API_KEY)) {
            process.exitCode = 2;
            return;
        }

        let output;

        if (input.includes("readiness response")) {
            output = {
                message: process.env.OPENAI_API_KEY ? "Secret leaked." : "Secrets are isolated.",
                status: "ready"
            };
        } else if (isRequirementReview && input.includes("User can export evidence.")) {
            output = {
                ambiguities: ["The export format is not specified."],
                missingInformation: ["Define the evidence included in the export."],
                suggestedRevision: {
                    statement: "The user can export requirement evidence as a JSON file.",
                    title: "Export requirement evidence"
                },
                summary: "The intent is clear, but the result needs a format and evidence boundary."
            };
        } else if (
            isTaskExecutionProposal &&
            input.includes('"functionalRequirement"') &&
            input.includes('"technicalRequirement"') &&
            input.includes('"task"') &&
            argumentsList.includes("--skip-git-repo-check") &&
            argumentsList.includes("--ephemeral") &&
            argumentsList.includes("--ignore-user-config") &&
            argumentsList.includes("--ignore-rules") &&
            argumentsList[argumentsList.indexOf("--sandbox") + 1] === "read-only" &&
            argumentsList.some(function (argument) {
                return argument.endsWith("codexTaskExecutionProposalOutput.schema.json");
            }) &&
            process.cwd().includes("slop-stop-codex-proposal-") &&
            !process.env.OPENAI_API_KEY
        ) {
            output = {
                proposedChanges: [{
                    description: "Add the bounded export service and its deterministic tests.",
                    path: "src/services/exportEvidence.js"
                }],
                risks: ["Exported evidence may expose fields outside the normalized contract."],
                summary: "Implement a normalized evidence export behind the existing service boundary.",
                validationSteps: ["Run the deterministic unit and architecture test suites."]
            };
        } else if (
            isTaskExecution &&
            input.includes('"approvedChain"') &&
            input.includes('"proposal"') &&
            argumentsList.includes("--ephemeral") &&
            argumentsList.includes("--ignore-user-config") &&
            argumentsList.includes("--ignore-rules") &&
            argumentsList[argumentsList.indexOf("--sandbox") + 1] === "workspace-write" &&
            argumentsList[argumentsList.indexOf("--ask-for-approval") + 1] === "never" &&
            argumentsList.some(function (argument) {
                return argument.endsWith("codexTaskExecutionOutput.schema.json");
            }) &&
            process.cwd().includes("slop-stop-execution-") &&
            fs.existsSync(path.resolve(process.cwd(), ".git")) &&
            !fs.readFileSync(path.resolve(process.cwd(), ".git", "config"), "utf8").includes("url =") &&
            !process.env.OPENAI_API_KEY
        ) {
            fs.writeFileSync(
                path.resolve(process.cwd(), "m5bCandidate.txt"),
                "Generated only inside the disposable workspace.\n",
                "utf8"
            );
            output = {
                summary: "Created one isolated implementation candidate.",
                validationNotes: ["No independent verification was performed."]
            };
        } else {
            process.exitCode = 2;
            return;
        }

        const event = JSON.stringify({
            item: {
                text: JSON.stringify(output),
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
