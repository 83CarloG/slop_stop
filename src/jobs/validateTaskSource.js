"use strict";

module.exports = function validateTaskSource(technicalRequirement) {
    if (!technicalRequirement) {
        const missingError = new Error("The originating technical requirement was not found.");
        missingError.code = "TECHNICAL_REQUIREMENT_NOT_FOUND";
        throw missingError;
    }

    if (technicalRequirement.status !== "approved") {
        const stateError = new Error("The originating technical requirement is not approved.");
        stateError.code = "TECHNICAL_REQUIREMENT_NOT_APPROVED";
        throw stateError;
    }

    return true;
};

