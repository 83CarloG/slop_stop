"use strict";

function createValidationError(message) {
    const error = new Error(message);
    error.code = "INVALID_REQUEST";
    return error;
}

function requireText(value, name, maximumLength) {
    if (typeof value !== "string" || value.trim() === "") {
        throw createValidationError(`${name} is required.`);
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length > maximumLength) {
        throw createValidationError(`${name} is too long.`);
    }

    return normalizedValue;
}

module.exports = function validateTechnicalRequirementInput(input) {
    if (!input || typeof input.action !== "string") {
        throw createValidationError("A technical requirement action is required.");
    }

    const output = {
        actorName: requireText(input.actorName, "actorName", 80)
    };

    if (input.action === "create") {
        output.functionalRequirementId = requireText(input.functionalRequirementId, "functionalRequirementId", 36);
        output.statement = requireText(input.statement, "statement", 4000);
        output.title = requireText(input.title, "title", 120);
    } else if (input.action === "revise") {
        output.note = requireText(input.note, "note", 500);
        output.statement = requireText(input.statement, "statement", 4000);
        output.title = requireText(input.title, "title", 120);
    } else if (input.action === "decide") {
        output.note = requireText(input.note, "note", 500);

        if (input.decision !== "approved" && input.decision !== "rejected") {
            throw createValidationError("decision must be approved or rejected.");
        }

        output.decision = input.decision;
    } else if (input.action !== "review") {
        throw createValidationError("The technical requirement action is invalid.");
    }

    return output;
};

