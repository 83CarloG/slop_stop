"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));

module.exports = async function listTechnicalRequirements(input) {
    const requirements = buildTechnicalRequirementViews(await eventStore({action: "read"}));
    const functionalRequirementId = input && input.functionalRequirementId;

    return {
        items: functionalRequirementId ? requirements.filter(function (item) {
            return item.functionalRequirementId === functionalRequirementId;
        }) : requirements
    };
};

