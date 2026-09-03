"use strict";

module.exports = function validateTaskExists(task) {
    if (!task) {
        const missingError = new Error("The task was not found.");
        missingError.code = "TASK_NOT_FOUND";
        throw missingError;
    }

    return true;
};

