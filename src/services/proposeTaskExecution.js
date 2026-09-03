"use strict";

const path = require("path");
const process = require("process");

const codex = require(path.resolve(process.cwd(), "src", "drivers", "codex.js"));
const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTaskExecutionProposal = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExecutionProposal.js"));
const validateTaskExists = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExists.js"));

function createCorruptionError() {
    const error = new Error("The task derivation chain is inconsistent.");
    error.code = "STORE_CORRUPTED";
    return error;
}

function findVersion(subject, version) {
    return subject.versions.find(function (item) {
        return item.version === version;
    });
}

function buildApprovedChain(events, taskId) {
    const task = buildTaskViews(events).find(function (item) {
        return item.id === taskId;
    });

    validateTaskExists(task);
    validateTaskExecutionProposal({task});

    const technicalRequirement = buildTechnicalRequirementViews(events).find(function (item) {
        return item.id === task.technicalRequirementId;
    });
    const functionalRequirement = technicalRequirement && buildFunctionalRequirementViews(events).find(function (item) {
        return item.id === technicalRequirement.functionalRequirementId;
    });
    const functionalVersion = functionalRequirement && findVersion(
        functionalRequirement,
        technicalRequirement.functionalRequirementVersion
    );
    const technicalVersion = technicalRequirement && findVersion(
        technicalRequirement,
        task.technicalRequirementVersion
    );
    const taskVersion = findVersion(task, task.approvedVersion);

    if (!functionalRequirement || !functionalVersion || !technicalRequirement || !technicalVersion || !taskVersion) {
        throw createCorruptionError();
    }

    return {
        approvedChain: {
            functionalRequirement: {
                source: functionalVersion.source,
                statement: functionalVersion.statement,
                title: functionalVersion.title,
                version: functionalVersion.version
            },
            task: {
                acceptanceCriteria: [...taskVersion.acceptanceCriteria],
                objective: taskVersion.objective,
                title: taskVersion.title,
                version: taskVersion.version
            },
            technicalRequirement: {
                statement: technicalVersion.statement,
                title: technicalVersion.title,
                version: technicalVersion.version
            }
        },
        task
    };
}

module.exports = async function proposeTaskExecution(input) {
    if (!input || input.confirmed !== true) {
        const error = new Error("Explicit confirmation is required.");
        error.code = "CONFIRMATION_REQUIRED";
        throw error;
    }

    const initialEvents = await eventStore({action: "read"});
    const initial = buildApprovedChain(initialEvents, input.taskId);
    const result = await codex({
        action: "proposeTaskExecution",
        approvedChain: initial.approvedChain,
        signal: input.signal
    });
    const currentEvents = await eventStore({action: "read"});
    const current = buildApprovedChain(currentEvents, input.taskId);

    if (current.task.currentVersion !== initial.task.currentVersion) {
        const error = new Error("The proposed task version is no longer current.");
        error.code = "TASK_NOT_READY";
        throw error;
    }

    const event = createRequirementEvent({
        actorKind: "ai",
        actorName: "Codex",
        eventType: "task_execution_proposed",
        payload: {
            proposal: result.proposal,
            taskId: current.task.id,
            version: current.task.currentVersion
        },
        requirementId: current.task.technicalRequirementId
    });

    await eventStore({action: "append", event});

    return buildTaskViews([...currentEvents, event]).find(function (item) {
        return item.id === current.task.id;
    });
};
