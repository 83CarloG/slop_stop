"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const validateTechnicalRequirementTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateTechnicalRequirementTransition.js"));

module.exports = async function getTechnicalRequirement(input) {
    const requirement = buildTechnicalRequirementViews(await eventStore({action: "read"})).find(function (item) {
        return item.id === input.requirementId;
    });

    validateTechnicalRequirementTransition({requirement, transition: "read"});
    return requirement;
};

