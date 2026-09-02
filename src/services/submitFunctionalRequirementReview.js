"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateRequirementInput = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementInput.js"));
const validateRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementTransition.js"));

module.exports = async function submitFunctionalRequirementReview(input) {
    const validatedInput = validateRequirementInput({...input, action: "review"});
    const events = await eventStore({action: "read"});
    const requirement = buildFunctionalRequirementViews(events).find(function (item) {
        return item.id === input.requirementId;
    });

    validateRequirementTransition({requirement, transition: "review"});

    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "functional_requirement_review_submitted",
        payload: {
            version: requirement.currentVersion
        },
        requirementId: requirement.id
    });

    await eventStore({action: "append", event});

    return buildFunctionalRequirementViews([...events, event]).find(function (item) {
        return item.id === requirement.id;
    });
};
