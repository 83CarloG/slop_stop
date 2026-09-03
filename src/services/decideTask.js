"use strict";

const path = require("path");
const process = require("process");

const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTaskLifecycleInput = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskLifecycleInput.js"));
const validateTaskTransition = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskTransition.js"));

module.exports = async function decideTask(input) {
    const validatedInput = validateTaskLifecycleInput({...input, action: "decide"});
    const events = await eventStore({action: "read"});
    const task = buildTaskViews(events).find(function (item) {
        return item.id === input.taskId;
    });

    validateTaskTransition({task, transition: "decide"});

    const event = createRequirementEvent({
        actorName: validatedInput.actorName,
        eventType: "task_decided",
        payload: {
            decision: validatedInput.decision,
            note: validatedInput.note,
            taskId: task.id,
            version: task.currentVersion
        },
        requirementId: task.technicalRequirementId
    });

    await eventStore({action: "append", event});

    return buildTaskViews([...events, event]).find(function (item) {
        return item.id === task.id;
    });
};
