"use strict";

module.exports = function validateTechnicalRequirementTransition(input) {
    if (!input.requirement) {
        const missingError = new Error("The technical requirement was not found.");
        missingError.code = "TECHNICAL_REQUIREMENT_NOT_FOUND";
        throw missingError;
    }

    const allowedStates = {
        decide: ["in_review"],
        read: ["approved", "draft", "in_review", "rejected"],
        revise: ["draft", "rejected"],
        review: ["draft"]
    };

    if (!allowedStates[input.transition] || !allowedStates[input.transition].includes(input.requirement.status)) {
        const transitionError = new Error("The technical requirement transition is not allowed.");
        transitionError.code = "INVALID_TECHNICAL_TRANSITION";
        throw transitionError;
    }

    return true;
};

