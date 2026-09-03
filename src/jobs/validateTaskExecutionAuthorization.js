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

module.exports = function validateTaskExecutionAuthorization(input) {
    if (!input || input.confirmed !== true) {
        throw createValidationError("Exact execution confirmation is required.");
    }

    return {
        actorName: requireText(input.actorName, "actorName", 80),
        note: requireText(input.note, "note", 500)
    };
};
