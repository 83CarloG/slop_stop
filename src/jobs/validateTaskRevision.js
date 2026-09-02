"use strict";

module.exports = function validateTaskRevision(task) {
    if (!task) {
        const missingError = new Error("The task was not found.");
        missingError.code = "TASK_NOT_FOUND";
        throw missingError;
    }

    if (task.status !== "draft") {
        const transitionError = new Error("The task cannot be revised in its current state.");
        transitionError.code = "INVALID_TASK_TRANSITION";
        throw transitionError;
    }

    return true;
};

