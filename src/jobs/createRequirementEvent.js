"use strict";

const crypto = require("crypto");

module.exports = function createRequirementEvent(input) {
    return {
        actor: {
            kind: input.actorKind || "human",
            name: input.actorName
        },
        eventId: crypto.randomUUID(),
        eventType: input.eventType,
        occurredAt: new Date().toISOString(),
        payload: input.payload,
        requirementId: input.requirementId,
        schemaVersion: 1
    };
};
