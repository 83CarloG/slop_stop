"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));

module.exports = async function listFunctionalRequirements() {
    const requirements = buildFunctionalRequirementViews(await eventStore({action: "read"}));

    return {
        items: requirements.map(function (requirement) {
            return {
                currentVersion: requirement.currentVersion,
                id: requirement.id,
                source: requirement.source,
                status: requirement.status,
                title: requirement.title,
                updatedAt: requirement.updatedAt
            };
        })
    };
};
