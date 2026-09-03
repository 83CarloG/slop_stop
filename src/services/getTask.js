"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const validateTaskExists = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExists.js"));

module.exports = async function getTask(input) {
    const task = buildTaskViews(await eventStore({action: "read"})).find(function (item) {
        return item.id === input.taskId;
    });

    validateTaskExists(task);
    return task;
};
