"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTechnicalRequirementInput = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementInput.js"));
const validateTechnicalRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementTransition.js"));

module.exports = async function submitTechnicalRequirementReview(input) {
    const validatedInput = validateTechnicalRequirementInput({...input, action: "review"});
    const events = await eventStore({action: "read"});
    const requirement = buildTechnicalRequirementViews(events).find(function (item) {
        return item.id === input.requirementId;
    });

    validateTechnicalRequirementTransition({requirement, transition: "review"});

    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "technical_requirement_review_submitted",
        payload: {
            version: requirement.currentVersion
        },
        requirementId: requirement.id
    });

    await eventStore({action: "append", event});

    return buildTechnicalRequirementViews([...events, event]).find(function (item) {
        return item.id === requirement.id;
    });
};

