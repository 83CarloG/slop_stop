"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const evaluateTaskReadiness = require(path.resolve(process.cwd(), "src", "jobs", "evaluateTaskReadiness.js"));
const validateTaskExists = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExists.js"));

function createCorruptionError() {
    const error = new Error("The task derivation chain is inconsistent.");
    error.code = "STORE_CORRUPTED";
    return error;
}

module.exports = async function evaluateTaskReadinessService(input) {
    const events = await eventStore({action: "read"});
    const task = buildTaskViews(events).find(function (item) {
        return item.id === input.taskId;
    });

    validateTaskExists(task);

    const technicalRequirement = buildTechnicalRequirementViews(events).find(function (item) {
        return item.id === task.technicalRequirementId;
    });
    const functionalRequirement = technicalRequirement && buildFunctionalRequirementViews(events).find(function (item) {
        return item.id === technicalRequirement.functionalRequirementId;
    });

    if (!technicalRequirement || !functionalRequirement) {
        throw createCorruptionError();
    }

    const evaluation = evaluateTaskReadiness({functionalRequirement, task, technicalRequirement});
    const event = createRequirementEvent({
        actorKind: "system",
        actorName: "readiness-check",
        eventType: "task_check_evaluated",
        payload: evaluation,
        requirementId: task.technicalRequirementId
    });

    await eventStore({action: "append", event});

    return buildTaskViews([...events, event]).find(function (item) {
        return item.id === task.id;
    });
};
