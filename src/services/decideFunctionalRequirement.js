"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateRequirementInput = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementInput.js"));
const validateRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementTransition.js"));

module.exports = async function decideFunctionalRequirement(input) {
    const validatedInput = validateRequirementInput({...input, action: "decide"});
    const events = await eventStore({action: "read"});
    const requirement = buildFunctionalRequirementViews(events).find(function (item) {
        return item.id === input.requirementId;
    });

    validateRequirementTransition({requirement, transition: "decide"});

    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "functional_requirement_decided",
        payload: {
            decision: validatedInput.decision,
            note: validatedInput.note,
            version: requirement.currentVersion
        },
        requirementId: requirement.id
    });

    await eventStore({action: "append", event});

    return buildFunctionalRequirementViews([...events, event]).find(function (item) {
        return item.id === requirement.id;
    });
};
