"use strict";

const path = require("path");
const process = require("process");

const buildFunctionalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildFunctionalRequirementViews.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const buildTechnicalRequirementViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTechnicalRequirementViews.js"));
const validateTaskExecutionCandidate = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExecutionCandidate.js"));
const validateTaskExists = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExists.js"));

function createCorruptionError() {
    const error = new Error("The task execution chain is inconsistent.");
    error.code = "STORE_CORRUPTED";
    return error;
}

function findVersion(subject, version) {
    return subject.versions.find(function (item) {
        return item.version === version;
    });
}

module.exports = function prepareTaskExecution(input) {
    const task = buildTaskViews(input.events).find(function (item) {
        return item.id === input.taskId;
    });

    validateTaskExists(task);
    const proposal = validateTaskExecutionCandidate({task});
    const technicalRequirement = buildTechnicalRequirementViews(input.events).find(function (item) {
        return item.id === task.technicalRequirementId;
    });
    const functionalRequirement = technicalRequirement && buildFunctionalRequirementViews(input.events).find(function (item) {
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
    const taskVersion = findVersion(task, task.currentVersion);

    if (!functionalVersion || !technicalVersion || !taskVersion) {
        throw createCorruptionError();
    }

    return {
        executionContext: {
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
            proposal: proposal.proposal
        },
        proposalCreatedAt: proposal.createdAt,
        task
    };
};
