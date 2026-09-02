"use strict";

const crypto = require("crypto");
const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTechnicalRequirementInput = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementInput.js"));
const validateTechnicalRequirementSource = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementSource.js"));

module.exports = async function createTechnicalRequirement(input) {
    const validatedInput = validateTechnicalRequirementInput({...input, action: "create"});
    const events = await eventStore({action: "read"});
    const functionalRequirement = buildFunctionalRequirementViews(events).find(function (item) {
        return item.id === validatedInput.functionalRequirementId;
    });

    validateTechnicalRequirementSource(functionalRequirement);

    const requirementId = crypto.randomUUID();
    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "technical_requirement_created",
        payload: {
            functionalRequirementId: functionalRequirement.id,
            functionalRequirementVersion: functionalRequirement.approvedVersion,
            statement: validatedInput.statement,
            title: validatedInput.title,
            version: 1
        },
        requirementId
    });

    await eventStore({action: "append", event});

    return buildTechnicalRequirementViews([...events, event]).find(function (item) {
        return item.id === requirementId;
    });
};

