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
    const testRoot = path.dirname(storePath);
    const artifactDirectory = path.resolve(testRoot, "executions");
    let removed = false;

    if (path.dirname(artifactDirectory) !== testRoot) {
        throw new Error("The test artifact path is invalid.");
    }

    if (fs.existsSync(storePath)) {
        fs.rmSync(storePath, {force: true});
        removed = true;
    }

    if (fs.existsSync(artifactDirectory)) {
        if (fs.lstatSync(artifactDirectory).isSymbolicLink()) {
            throw new Error("The test artifact directory must not be symbolic.");
        }

        fs.rmSync(artifactDirectory, {force: true, recursive: true});
        removed = true;
    }

    return removed;
}

async function seedTestProject() {
    const creator = "Test project seed";
    const reviewer = "Test project reviewer";
    const functional = await createFunctionalRequirement({
        actorName: creator,
        source: "M5B test project",
        statement: "The user can review a generated English project note before any application.",
        title: "Review a generated project note"
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
        statement: "Create examples/m5b-review-summary.md only inside the disposable clone.",
        title: "Define an isolated review note"
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
            "The candidate creates examples/m5b-review-summary.md.",
            "The file starts with the heading # M5B Review Candidate.",
            "The file states that the candidate requires human review before application."
        ],
        actorName: creator,
        objective: "Create the bounded English review note described by the acceptance criteria.",
        technicalRequirementId: technical.id,
        title: "Create an isolated review summary"
    });

    await submitTaskReview({actorName: reviewer, taskId: task.id});
    await decideTask({
        actorName: reviewer,
        decision: "approved",
        note: "Approved for the isolated M5B test.",
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
