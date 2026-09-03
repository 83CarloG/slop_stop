"use strict";

const crypto = require("crypto");
const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTaskInput = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskInput.js"));
const validateTaskSource = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskSource.js"));

module.exports = async function createTask(input) {
    const validatedInput = validateTaskInput({...input, action: "create"});
    const events = await eventStore({action: "read"});
    const technicalRequirement = buildTechnicalRequirementViews(events).find(function (item) {
        return item.id === validatedInput.technicalRequirementId;
    });

    validateTaskSource(technicalRequirement);

    const taskId = crypto.randomUUID();
    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "task_created",
        payload: {
            acceptanceCriteria: validatedInput.acceptanceCriteria,
            objective: validatedInput.objective,
            taskId,
            technicalRequirementVersion: technicalRequirement.approvedVersion,
            title: validatedInput.title,
            version: 1
        },
        requirementId: technicalRequirement.id
    });

    await eventStore({action: "append", event});

    return buildTaskViews([...events, event]).find(function (item) {
        return item.id === taskId;
    });
};

