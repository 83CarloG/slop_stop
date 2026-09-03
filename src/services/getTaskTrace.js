"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const buildTaskTrace = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskTrace.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const validateTaskExists = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExists.js"));

module.exports = async function getTaskTrace(input) {
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
        const error = new Error("The task process trace is inconsistent.");
        error.code = "STORE_CORRUPTED";
        throw error;
    }

    return buildTaskTrace({events, functionalRequirement, task, technicalRequirement});
};
