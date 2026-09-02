"use strict";

module.exports = function validateTechnicalRequirementSource(functionalRequirement) {
    if (!functionalRequirement) {
        const missingError = new Error("The originating functional requirement was not found.");
        missingError.code = "FUNCTIONAL_REQUIREMENT_NOT_FOUND";
        throw missingError;
    }

    if (functionalRequirement.status !== "approved") {
        const stateError = new Error("The originating functional requirement is not approved.");
        stateError.code = "FUNCTIONAL_REQUIREMENT_NOT_APPROVED";
        throw stateError;
    }

    return true;
};

