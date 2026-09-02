"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const process = require("process");

const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const proposeFunctionalRequirementAiReview = require(path.resolve(process.cwd(), "src", "services", "proposeFunctionalRequirementAiReview.js"));

async function run() {
    const previousStorePath = process.env.EVENT_STORE_PATH;
    const temporaryRoot = path.resolve(os.tmpdir());
    const temporaryDirectory = fs.mkdtempSync(path.resolve(temporaryRoot, "slop-stop-codex-review-"));
    const relativeDirectory = path.relative(temporaryRoot, temporaryDirectory);

    if (relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) {
        throw new Error("The temporary review path is invalid.");
    }

    process.env.EVENT_STORE_PATH = path.resolve(temporaryDirectory, "events.jsonl");

    try {
        const requirement = await createFunctionalRequirement({
            actorName: "Codex review smoke",
            source: "Fixed local smoke input",
            statement: "The user can export requirement evidence.",
            title: "Export requirement evidence"
        });
        const reviewed = await proposeFunctionalRequirementAiReview({
            confirmed: true,
            requirementId: requirement.id
        });
        const proposal = reviewed.aiReviews.at(-1);

        process.stdout.write(`${JSON.stringify({
            provider: proposal.actor.name,
            review: proposal.review,
            status: "ok",
            version: proposal.version
        }, null, 2)}\n`);
    } finally {
        if (previousStorePath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousStorePath;
        }

        fs.rmSync(temporaryDirectory, {force: true, recursive: true});
    }
}

run().catch(function () {
    process.stderr.write("Codex requirement review smoke test failed.\n");
    process.exitCode = 1;
});
