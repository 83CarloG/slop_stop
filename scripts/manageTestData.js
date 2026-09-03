"use strict";

const fs = require("fs");
const path = require("path");
const process = require("process");

const createFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "createFunctionalRequirement.js"));
const createTask = require(path.resolve(process.cwd(), "src", "services", "createTask.js"));
const createTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "createTechnicalRequirement.js"));
const decideFunctionalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideFunctionalRequirement.js"));
const decideTask = require(path.resolve(process.cwd(), "src", "services", "decideTask.js"));
const decideTechnicalRequirement = require(path.resolve(process.cwd(), "src", "services", "decideTechnicalRequirement.js"));
const evaluateTaskReadiness = require(path.resolve(process.cwd(), "src", "services", "evaluateTaskReadiness.js"));
const submitFunctionalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitFunctionalRequirementReview.js"));
const submitTaskReview = require(path.resolve(process.cwd(), "src", "services", "submitTaskReview.js"));
const submitTechnicalRequirementReview = require(path.resolve(process.cwd(), "src", "services", "submitTechnicalRequirementReview.js"));

function resolveTestStore(targetRoot) {
    const absoluteRoot = path.resolve(targetRoot);
    const dataRoot = path.resolve(absoluteRoot, ".data");
    const testRoot = path.resolve(dataRoot, "test");
    const storePath = path.resolve(testRoot, "events.jsonl");
    const expectedRelativePath = path.join(".data", "test", "events.jsonl");

    if (
        path.relative(absoluteRoot, storePath) !== expectedRelativePath ||
        path.dirname(storePath) !== testRoot ||
        path.dirname(testRoot) !== dataRoot
    ) {
        throw new Error("The test event store path is invalid.");
    }

    for (const directory of [dataRoot, testRoot]) {
        if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
            throw new Error("The test event store must not use symbolic directories.");
        }
    }

    return storePath;
}

function cleanTestStore(storePath) {
    if (!fs.existsSync(storePath)) {
        return false;
    }

    fs.rmSync(storePath, {force: true});
    return true;
}

async function seedTestProject() {
    const creator = "Test project seed";
    const reviewer = "Test project reviewer";
    const functional = await createFunctionalRequirement({
        actorName: creator,
        source: "M5A test project",
        statement: "The user can review a bounded implementation proposal before execution.",
        title: "Review an implementation proposal"
    });

    await submitFunctionalRequirementReview({actorName: reviewer, requirementId: functional.id});
    await decideFunctionalRequirement({
        actorName: reviewer,
        decision: "approved",
        note: "Approved as the functional origin for the test project.",
        requirementId: functional.id
    });

    const technical = await createTechnicalRequirement({
        actorName: creator,
        functionalRequirementId: functional.id,
        statement: "Request a structured Codex proposal without granting workspace write access.",
        title: "Prepare a read-only Codex proposal"
    });

    await submitTechnicalRequirementReview({actorName: reviewer, requirementId: technical.id});
    await decideTechnicalRequirement({
        actorName: reviewer,
        decision: "approved",
        note: "Approved as the technical origin for the test project.",
        requirementId: technical.id
    });

    const task = await createTask({
        acceptanceCriteria: [
            "The proposal lists bounded file changes.",
            "The proposal lists validation steps and risks.",
            "The task remains approved after the proposal is recorded."
        ],
        actorName: creator,
        objective: "Generate and inspect one governed execution proposal.",
        technicalRequirementId: technical.id,
        title: "Test the governed execution proposal"
    });

    await submitTaskReview({actorName: reviewer, taskId: task.id});
    await decideTask({
        actorName: reviewer,
        decision: "approved",
        note: "Approved for the isolated M5A test.",
        taskId: task.id
    });
    const readyTask = await evaluateTaskReadiness({taskId: task.id});

    return {
        functionalRequirementId: functional.id,
        readiness: readyTask.checks.at(-1).consequence,
        taskId: task.id,
        technicalRequirementId: technical.id
    };
}

async function manageTestData(action, targetRoot = process.cwd()) {
    if (action !== "clean" && action !== "seed" && action !== "reset") {
        throw new Error("Action must be clean, seed, or reset.");
    }

    const storePath = resolveTestStore(targetRoot);
    const previousStorePath = process.env.EVENT_STORE_PATH;
    let removed = false;

    process.env.EVENT_STORE_PATH = storePath;

    try {
        if (action === "clean" || action === "reset") {
            removed = cleanTestStore(storePath);
        }

        if (action === "seed" || action === "reset") {
            if (fs.existsSync(storePath) && fs.readFileSync(storePath, "utf8").trim() !== "") {
                const error = new Error("The test event store is not empty. Clean it before seeding.");
                error.code = "TEST_DATA_NOT_EMPTY";
                throw error;
            }

            return {
                action,
                project: await seedTestProject(),
                removed,
                storePath
            };
        }

        return {action, removed, storePath};
    } finally {
        if (previousStorePath === undefined) {
            delete process.env.EVENT_STORE_PATH;
        } else {
            process.env.EVENT_STORE_PATH = previousStorePath;
        }
    }
}

module.exports = manageTestData;

if (require.main === module) {
    manageTestData(process.argv[2]).then(function (result) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }).catch(function (error) {
        process.stderr.write(`${JSON.stringify({
            code: error.code || "TEST_DATA_ERROR",
            message: error.message,
            status: "error"
        }, null, 2)}\n`);
        process.exitCode = 1;
    });
}
