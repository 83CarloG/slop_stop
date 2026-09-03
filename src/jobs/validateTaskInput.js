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

function requireCriteria(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
        throw createValidationError("acceptanceCriteria must contain between one and ten items.");
    }

    return value.map(function (item) {
        return requireText(item, "acceptanceCriteria item", 500);
    });
}

module.exports = function validateTaskInput(input) {
    if (!input || (input.action !== "create" && input.action !== "revise")) {
        throw createValidationError("A valid task action is required.");
    }

    const output = {
        acceptanceCriteria: requireCriteria(input.acceptanceCriteria),
        actorName: requireText(input.actorName, "actorName", 80),
        objective: requireText(input.objective, "objective", 2000),
        title: requireText(input.title, "title", 120)
    };

    if (input.action === "create") {
        output.technicalRequirementId = requireText(input.technicalRequirementId, "technicalRequirementId", 36);
    } else {
        output.note = requireText(input.note, "note", 500);
    }

    return output;
};

