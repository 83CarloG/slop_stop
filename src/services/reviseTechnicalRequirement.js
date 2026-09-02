"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTechnicalRequirementInput = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementInput.js"));
const validateTechnicalRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementTransition.js"));

module.exports = async function reviseTechnicalRequirement(input) {
    const validatedInput = validateTechnicalRequirementInput({...input, action: "revise"});
    const events = await eventStore({action: "read"});
    const requirement = buildTechnicalRequirementViews(events).find(function (item) {
        return item.id === input.requirementId;
    });

    validateTechnicalRequirementTransition({requirement, transition: "revise"});

    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "technical_requirement_revised",
        payload: {
            note: validatedInput.note,
            statement: validatedInput.statement,
            title: validatedInput.title,
            version: requirement.currentVersion + 1
        },
        requirementId: requirement.id
    });

    await eventStore({action: "append", event});

    return buildTechnicalRequirementViews([...events, event]).find(function (item) {
        return item.id === requirement.id;
    });
};

