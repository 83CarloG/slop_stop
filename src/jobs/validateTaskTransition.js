"use strict";

module.exports = function validateTaskTransition(input) {
    if (!input.task) {
        const missingError = new Error("The task was not found.");
        missingError.code = "TASK_NOT_FOUND";
        throw missingError;
    }

    const allowedStates = {
        decide: ["in_review"],
        revise: ["draft", "rejected"],
        review: ["draft"]
    };

    if (!allowedStates[input.transition] || !allowedStates[input.transition].includes(input.task.status)) {
        const transitionError = new Error("The task transition is not allowed.");
        transitionError.code = "INVALID_TASK_TRANSITION";
        throw transitionError;
    }

    return true;
};
