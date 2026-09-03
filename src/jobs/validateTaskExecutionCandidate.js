"use strict";

module.exports = function validateTaskExecutionCandidate(input) {
    const latestCheck = input.task.checks.at(-1);
    const latestProposal = input.task.executionProposals.at(-1);

    if (
        input.task.status !== "approved" ||
        input.task.approvedVersion !== input.task.currentVersion ||
        !latestCheck ||
        latestCheck.version !== input.task.currentVersion ||
        latestCheck.status !== "passed" ||
        latestCheck.consequence !== "allow" ||
        !latestProposal ||
        latestProposal.version !== input.task.currentVersion
    ) {
        const error = new Error("The task is not ready for isolated execution.");
        error.code = "TASK_EXECUTION_NOT_READY";
        throw error;
    }

    return latestProposal;
};
