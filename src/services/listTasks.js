"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));

module.exports = async function listTasks(input) {
    const tasks = buildTaskViews(await eventStore({action: "read"}));
    const technicalRequirementId = input && input.technicalRequirementId;

    return {
        items: technicalRequirementId ? tasks.filter(function (task) {
            return task.technicalRequirementId === technicalRequirementId;
        }) : tasks
    };
};

