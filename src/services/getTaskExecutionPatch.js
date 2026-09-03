"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const workspace = require(path.resolve(process.cwd(), "src", "drivers", "workspace.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const validateTaskExists = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExists.js"));

module.exports = async function getTaskExecutionPatch(input) {
    const task = buildTaskViews(await eventStore({action: "read"})).find(function (item) {
        return item.id === input.taskId;
    });

    validateTaskExists(task);
    const execution = task.executions.find(function (item) {
        return item.id === input.executionId;
    });

    if (!execution || !execution.candidate) {
        const error = new Error("The task execution candidate was not found.");
        error.code = "EXECUTION_NOT_FOUND";
        throw error;
    }

    return {
        content: await workspace({
            action: "readPatch",
            executionId: execution.id,
            expectedSha256: execution.candidate.patchSha256
        }),
        executionId: execution.id,
        patchSha256: execution.candidate.patchSha256
    };
};
