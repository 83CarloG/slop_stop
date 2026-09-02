"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const validateRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateRequirementTransition.js"));

module.exports = async function getFunctionalRequirement(input) {
    const requirement = buildFunctionalRequirementViews(await eventStore({action: "read"})).find(function (item) {
        return item.id === input.requirementId;
    });

    validateRequirementTransition({requirement, transition: "read"});
    return requirement;
};
