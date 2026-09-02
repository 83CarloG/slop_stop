"use strict";

const path = require("path");
const process = require("process");

const codex = require(path.resolve(process.cwd(), "src", "drivers", "codex.js"));
const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementTransition.js"));

function findRequirement(events, requirementId) {
    return buildFunctionalRequirementViews(events).find(function (item) {
        return item.id === requirementId;
    });
}

module.exports = async function proposeFunctionalRequirementAiReview(input) {
    if (!input || input.confirmed !== true) {
        const confirmationError = new Error("Explicit confirmation is required.");
        confirmationError.code = "CONFIRMATION_REQUIRED";
        throw confirmationError;
    }

    const initialEvents = await eventStore({action: "read"});
    const initialRequirement = findRequirement(initialEvents, input.requirementId);
    validateRequirementTransition({requirement: initialRequirement, transition: "aiReview"});

    const version = initialRequirement.versions.find(function (item) {
        return item.version === initialRequirement.currentVersion;
    });
    const result = await codex({
        action: "reviewRequirement",
        requirement: {
            source: version.source,
            statement: version.statement,
            title: version.title,
            version: version.version
        },
        signal: input.signal
    });

    const currentEvents = await eventStore({action: "read"});
    const currentRequirement = findRequirement(currentEvents, input.requirementId);
    validateRequirementTransition({requirement: currentRequirement, transition: "aiReview"});

    if (currentRequirement.currentVersion !== version.version) {
        const transitionError = new Error("The reviewed requirement version is no longer current.");
        transitionError.code = "INVALID_TRANSITION";
        throw transitionError;
    }

    const event = createRequirementEvent({
        actorKind: "ai",
        actorName: "Codex",
        eventType: "ai_review_proposed",
        payload: {
            review: result.review,
            version: version.version
        },
        requirementId: currentRequirement.id
    });

    await eventStore({action: "append", event});
    return findRequirement([...currentEvents, event], currentRequirement.id);
};
