"use strict";

const fs = require("fs");
const path = require("path");
const process = require("process");

const getApplicationConfig = require(path.resolve(process.cwd(), "config", "application.js"));

function createStoreError(message) {
    const error = new Error(message);
    error.code = "STORE_CORRUPTED";
    return error;
}

function validateEvent(event) {
    const actorIsValid = event &&
        event.actor &&
        (event.actor.kind === "human" || event.actor.kind === "ai" || event.actor.kind === "system") &&
        typeof event.actor.name === "string" &&
        event.actor.name.length > 0;

    if (
        !event ||
        event.schemaVersion !== 1 ||
        typeof event.eventId !== "string" ||
        typeof event.eventType !== "string" ||
        typeof event.occurredAt !== "string" ||
        typeof event.requirementId !== "string" ||
        !actorIsValid ||
        !event.payload ||
        Array.isArray(event.payload) ||
        typeof event.payload !== "object"
    ) {
        throw createStoreError("The event store contains an invalid event.");
    }

    return event;
}

function readEvents(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/u).filter(function (line) {
        return line.trim() !== "";
    });

    return lines.map(function (line) {
        try {
            return validateEvent(JSON.parse(line));
        } catch (error) {
            if (error.code === "STORE_CORRUPTED") {
                throw error;
            }

            throw createStoreError("The event store contains malformed JSONL.");
        }
    });
}

function appendEvent(filePath, event) {
    validateEvent(event);

    // Refuse to extend a damaged history because later evidence would become unreliable.
    readEvents(filePath);
    fs.mkdirSync(path.dirname(filePath), {recursive: true});

    const descriptor = fs.openSync(filePath, "a");

    try {
        fs.writeSync(descriptor, `${JSON.stringify(event)}\n`, null, "utf8");
        fs.fsyncSync(descriptor);
    } finally {
        fs.closeSync(descriptor);
    }
}

module.exports = async function eventStore(input) {
    const config = getApplicationConfig();

    if (!input || input.action === "read") {
        return readEvents(config.eventStorePath);
    }

    if (input.action === "append") {
        appendEvent(config.eventStorePath, input.event);
        return input.event;
    }

    throw createStoreError("The event store action is invalid.");
};
