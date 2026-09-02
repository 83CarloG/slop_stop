"use strict";

module.exports = function validateRequirementTransition(input) {
    const requirement = input.requirement;
    const transition = input.transition;

    if (!requirement) {
        const missingError = new Error("The functional requirement was not found.");
        missingError.code = "REQUIREMENT_NOT_FOUND";
        throw missingError;
    }

    const allowedStates = {
        aiReview: ["draft"],
        decide: ["in_review"],
        read: ["approved", "draft", "in_review", "rejected"],
        revise: ["draft", "rejected"],
        review: ["draft"]
    };

    if (!allowedStates[transition] || !allowedStates[transition].includes(requirement.status)) {
        const transitionError = new Error("The functional requirement transition is not allowed.");
        transitionError.code = "INVALID_TRANSITION";
        throw transitionError;
    }

    return true;
};
