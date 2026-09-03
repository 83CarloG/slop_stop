"use strict";

module.exports = function validateTaskExecutionProposal(input) {
    const latestCheck = input.task.checks.at(-1);

    if (
        input.task.status !== "approved" ||
        input.task.approvedVersion !== input.task.currentVersion ||
        !latestCheck ||
        latestCheck.version !== input.task.currentVersion ||
        latestCheck.status !== "passed" ||
        latestCheck.consequence !== "allow"
    ) {
        const error = new Error("The task is not ready for an execution proposal.");
        error.code = "TASK_NOT_READY";
        throw error;
    }

    return input.task;
};
