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

module.exports = function validateTaskLifecycleInput(input) {
    if (!input || (input.action !== "review" && input.action !== "decide")) {
        throw createValidationError("A valid task lifecycle action is required.");
    }

    const output = {
        actorName: requireText(input.actorName, "actorName", 80)
    };

    if (input.action === "decide") {
        if (input.decision !== "approved" && input.decision !== "rejected") {
            throw createValidationError("decision must be approved or rejected.");
        }

        output.decision = input.decision;
        output.note = requireText(input.note, "note", 500);
    }

    return output;
};
