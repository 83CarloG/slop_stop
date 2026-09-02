"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTaskInput = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskInput.js"));
const validateTaskRevision = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskRevision.js"));

module.exports = async function reviseTask(input) {
    const validatedInput = validateTaskInput({...input, action: "revise"});
    const events = await eventStore({action: "read"});
    const task = buildTaskViews(events).find(function (item) {
        return item.id === input.taskId;
    });

    validateTaskRevision(task);

    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "task_revised",
        payload: {
            acceptanceCriteria: validatedInput.acceptanceCriteria,
            note: validatedInput.note,
            objective: validatedInput.objective,
            taskId: task.id,
            title: validatedInput.title,
            version: task.currentVersion + 1
        },
        requirementId: task.technicalRequirementId
    });

    await eventStore({action: "append", event});

    return buildTaskViews([...events, event]).find(function (item) {
        return item.id === task.id;
    });
};

