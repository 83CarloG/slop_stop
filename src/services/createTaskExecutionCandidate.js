"use strict";

const crypto = require("crypto");
const path = require("path");
const process = require("process");

const codex = require(path.resolve(process.cwd(), "src", "drivers", "codex.js"));
const eventStore = require(path.resolve(process.cwd(), "src", "drivers", "eventStore.js"));
const workspace = require(path.resolve(process.cwd(), "src", "drivers", "workspace.js"));
const buildTaskViews = require(path.resolve(process.cwd(), "src", "jobs", "buildTaskViews.js"));
const createRequirementEvent = require(path.resolve(process.cwd(), "src", "jobs", "createRequirementEvent.js"));
const validateTaskExecutionAuthorization = require(path.resolve(process.cwd(), "src", "jobs", "validateTaskExecutionAuthorization.js"));
const prepareTaskExecution = require(path.resolve(process.cwd(), "src", "operations", "prepareTaskExecution.js"));

function normalizeFailureCode(error) {
    if (error && typeof error.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code)) {
        return error.code;
    }

    return "EXECUTION_FAILED";
}

async function recordFailure(input) {
    try {
        const events = await eventStore({action: "read"});
        const task = buildTaskViews(events).find(function (item) {
            return item.id === input.taskId;
        });
        const execution = task && task.executions.find(function (item) {
            return item.id === input.executionId;
        });

        if (!task || !execution || execution.status !== "running") {
            return;
        }

        const event = createRequirementEvent({
            actorKind: "system",
            actorName: "execution-controller",
            eventType: "task_execution_failed",
            payload: {
                code: normalizeFailureCode(input.error),
                executionId: input.executionId,
                taskId: input.taskId,
                version: execution.version
            },
            requirementId: task.technicalRequirementId
        });

        await eventStore({action: "append", event});
    } catch (error) {
        // Preserve the execution error; damaged evidence will still block later reads.
    }
}

module.exports = async function createTaskExecutionCandidate(input) {
    const authorization = validateTaskExecutionAuthorization(input);
    const initialEvents = await eventStore({action: "read"});
    const initial = prepareTaskExecution({events: initialEvents, taskId: input.taskId});
    const executionId = crypto.randomUUID();
    const authorizationEvent = createRequirementEvent({
        actorName: authorization.actorName,
        eventType: "task_execution_authorized",
        payload: {
            executionId,
            note: authorization.note,
            proposalCreatedAt: initial.proposalCreatedAt,
            taskId: initial.task.id,
            version: initial.task.currentVersion
        },
        requirementId: initial.task.technicalRequirementId
    });
    let artifactStored = false;
    let snapshot = null;

    await eventStore({action: "append", event: authorizationEvent});

    try {
        snapshot = await workspace({action: "createSnapshot"});
        const codexResult = await codex({
            action: "executeTask",
            executionContext: initial.executionContext,
            signal: input.signal,
            workspacePath: snapshot.workspacePath
        });
        const captured = await workspace({
            action: "captureChanges",
            workspacePath: snapshot.workspacePath
        });
        const artifact = await workspace({
            action: "storePatch",
            executionId,
            patch: captured.patch
        });

        artifactStored = true;

        const currentEvents = await eventStore({action: "read"});
        const current = prepareTaskExecution({events: currentEvents, taskId: input.taskId});

        if (
            current.task.currentVersion !== initial.task.currentVersion ||
            current.proposalCreatedAt !== initial.proposalCreatedAt
        ) {
            const error = new Error("The authorized task context changed during execution.");
            error.code = "TASK_EXECUTION_NOT_READY";
            throw error;
        }

        const candidateEvent = createRequirementEvent({
            actorKind: "ai",
            actorName: "Codex",
            eventType: "task_execution_candidate_created",
            payload: {
                artifact: artifact.artifact,
                bytes: artifact.bytes,
                changedFiles: captured.changedFiles,
                executionId,
                patchSha256: artifact.sha256,
                sourceRevision: snapshot.sourceRevision,
                summary: codexResult.result.summary,
                taskId: current.task.id,
                validationNotes: codexResult.result.validationNotes,
                version: current.task.currentVersion
            },
            requirementId: current.task.technicalRequirementId
        });

        await eventStore({action: "append", event: candidateEvent});
        artifactStored = false;

        return buildTaskViews([...currentEvents, candidateEvent]).find(function (item) {
            return item.id === current.task.id;
        });
    } catch (error) {
        if (artifactStored) {
            await workspace({action: "deletePatch", executionId});
        }

        await recordFailure({error, executionId, taskId: input.taskId});
        throw error;
    } finally {
        if (snapshot) {
            await workspace({
                action: "cleanupSnapshot",
                temporaryDirectory: snapshot.temporaryDirectory
            });
        }
    }
};
