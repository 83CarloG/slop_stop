"use strict";

const crypto = require("crypto");
const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateRequirementInput = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementInput.js"));

module.exports = async function createFunctionalRequirement(input) {
    const validatedInput = validateRequirementInput({...input, action: "create"});
    const events = await eventStore({action: "read"});
    const requirementId = crypto.randomUUID();
    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "functional_requirement_created",
        payload: {
            source: validatedInput.source,
            statement: validatedInput.statement,
            title: validatedInput.title,
            version: 1
        },
        requirementId
    });

    await eventStore({action: "append", event});

    return buildFunctionalRequirementViews([...events, event]).find(function (requirement) {
        return requirement.id === requirementId;
    });
};
