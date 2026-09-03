"use strict";

function createCorruptionError() {
    const error = new Error("The task event history is inconsistent.");
    error.code = "STORE_CORRUPTED";
    return error;
}

function acceptanceCriteriaAreValid(value) {
    return Array.isArray(value) &&
        value.length >= 1 &&
        value.length <= 10 &&
        value.every(function (item) {
            return typeof item === "string" && item.trim().length > 0 && item.length <= 500;
        });
}

function createVersion(event) {
    return {
        acceptanceCriteria: [...event.payload.acceptanceCriteria],
        actor: event.actor,
        createdAt: event.occurredAt,
        note: event.payload.note || null,
        objective: event.payload.objective,
        title: event.payload.title,
        version: event.payload.version
    };
}

function readinessCheckIsValid(event, task) {
    const payload = event.payload;
    const expectedRuleIds = [
        "task_version_approved",
        "technical_origin_approved",
        "functional_origin_approved"
    ];
    const rulesAreValid = Array.isArray(payload.rules) &&
        payload.rules.length === expectedRuleIds.length &&
        payload.rules.every(function (rule, index) {
            return rule &&
                Object.keys(rule).sort().join(",") === "ruleId,status" &&
                rule.ruleId === expectedRuleIds[index] &&
                (rule.status === "passed" || rule.status === "failed");
        });
    const derivedStatus = rulesAreValid && payload.rules.every(function (rule) {
        return rule.status === "passed";
    }) ? "passed" : "failed";
    const expectedTaskRuleStatus = task.status === "approved" &&
        task.approvedVersion === task.currentVersion ? "passed" : "failed";
    const expectedConsequence = derivedStatus === "passed" ? "allow" :
        (task.status === "in_review" ? "human_intervention" : "stop");

    return event.actor.kind === "system" &&
        event.actor.name === "readiness-check" &&
        Object.keys(payload).sort().join(",") === "checkId,consequence,rules,status,taskId,version" &&
        payload.checkId === "approved_chain" &&
        payload.taskId === task.id &&
        payload.version === task.currentVersion &&
        rulesAreValid &&
        payload.rules[0].status === expectedTaskRuleStatus &&
        payload.rules[1].status === "passed" &&
        payload.rules[2].status === "passed" &&
        payload.status === derivedStatus &&
        payload.consequence === expectedConsequence;
}

function stringArrayIsValid(value, maximumItems, maximumLength) {
    return Array.isArray(value) &&
        value.length <= maximumItems &&
        value.every(function (item) {
            return typeof item === "string" && item.trim().length > 0 && item.length <= maximumLength;
        });
}

function executionProposalIsValid(event, task) {
    const proposal = event.payload.proposal;
    const latestCheck = task.checks.at(-1);
    const changesAreValid = proposal &&
        Array.isArray(proposal.proposedChanges) &&
        proposal.proposedChanges.length >= 1 &&
        proposal.proposedChanges.length <= 20 &&
        proposal.proposedChanges.every(function (change) {
            return change &&
                Object.keys(change).sort().join(",") === "description,path" &&
                typeof change.path === "string" &&
                /^[A-Za-z0-9._/-]+$/u.test(change.path) &&
                !change.path.startsWith("/") &&
                change.path.split("/").every(function (segment) {
                    return segment !== "" && segment !== "." && segment !== "..";
                }) &&
                typeof change.description === "string" &&
                change.description.trim().length > 0 &&
                change.description.length <= 1000;
        });

    return event.actor.kind === "ai" &&
        event.actor.name === "Codex" &&
        Object.keys(event.payload).sort().join(",") === "proposal,taskId,version" &&
        event.payload.taskId === task.id &&
        event.payload.version === task.currentVersion &&
        task.status === "approved" &&
        task.approvedVersion === task.currentVersion &&
        latestCheck &&
        latestCheck.version === task.currentVersion &&
        latestCheck.status === "passed" &&
        latestCheck.consequence === "allow" &&
        proposal &&
        Object.keys(proposal).sort().join(",") === "proposedChanges,risks,summary,validationSteps" &&
        typeof proposal.summary === "string" &&
        proposal.summary.trim().length > 0 &&
        proposal.summary.length <= 1000 &&
        changesAreValid &&
        stringArrayIsValid(proposal.validationSteps, 10, 500) &&
        proposal.validationSteps.length >= 1 &&
        stringArrayIsValid(proposal.risks, 10, 500);
}

function taskIsExecutable(task) {
    const latestCheck = task.checks.at(-1);
    const latestProposal = task.executionProposals.at(-1);

    return task.status === "approved" &&
        task.approvedVersion === task.currentVersion &&
        latestCheck &&
        latestCheck.version === task.currentVersion &&
        latestCheck.status === "passed" &&
        latestCheck.consequence === "allow" &&
        latestProposal &&
        latestProposal.version === task.currentVersion;
}

function executionAuthorizationIsValid(event, task) {
    const payload = event.payload;
    const latestProposal = task.executionProposals.at(-1);

    return taskIsExecutable(task) &&
        event.actor.kind === "human" &&
        Object.keys(payload).sort().join(",") === "executionId,note,proposalCreatedAt,taskId,version" &&
        payload.taskId === task.id &&
        payload.version === task.currentVersion &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(payload.executionId) &&
        !task.executions.some(function (execution) {
            return execution.id === payload.executionId;
        }) &&
        payload.proposalCreatedAt === latestProposal.createdAt &&
        typeof payload.note === "string" &&
        payload.note.trim().length > 0 &&
        payload.note.length <= 500;
}

function pathIsSafeRelative(value) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= 260 &&
        /^[A-Za-z0-9._/-]+$/u.test(value) &&
        !value.startsWith("/") &&
        value.split("/").every(function (segment) {
            return segment !== "" && segment !== "." && segment !== "..";
        });
}

function executionCandidateIsValid(event, task, execution) {
    const payload = event.payload;
    const changedFilesAreValid = Array.isArray(payload.changedFiles) &&
        payload.changedFiles.length >= 1 &&
        payload.changedFiles.length <= 50 &&
        new Set(payload.changedFiles).size === payload.changedFiles.length &&
        payload.changedFiles.every(pathIsSafeRelative);

    return execution &&
        execution.status === "running" &&
        event.actor.kind === "ai" &&
        event.actor.name === "Codex" &&
        Object.keys(payload).sort().join(",") === "artifact,bytes,changedFiles,executionId,patchSha256,sourceRevision,summary,taskId,validationNotes,version" &&
        payload.taskId === task.id &&
        payload.version === execution.version &&
        payload.executionId === execution.id &&
        payload.artifact === `executions/${execution.id}.patch` &&
        Number.isInteger(payload.bytes) &&
        payload.bytes > 0 &&
        payload.bytes <= 512 * 1024 &&
        changedFilesAreValid &&
        /^[0-9a-f]{64}$/u.test(payload.patchSha256) &&
        /^[0-9a-f]{40,64}$/u.test(payload.sourceRevision) &&
        typeof payload.summary === "string" &&
        payload.summary.trim().length > 0 &&
        payload.summary.length <= 1000 &&
        stringArrayIsValid(payload.validationNotes, 10, 500);
}

function executionFailureIsValid(event, task, execution) {
    const payload = event.payload;

    return execution &&
        execution.status === "running" &&
        event.actor.kind === "system" &&
        event.actor.name === "execution-controller" &&
        Object.keys(payload).sort().join(",") === "code,executionId,taskId,version" &&
        payload.taskId === task.id &&
        payload.version === execution.version &&
        payload.executionId === execution.id &&
        typeof payload.code === "string" &&
        /^[A-Z][A-Z0-9_]{0,63}$/u.test(payload.code);
}

module.exports = function buildTaskViews(events) {
    const views = new Map();

    for (const event of events) {
        if (!event.eventType.startsWith("task_")) {
            continue;
        }

        const taskId = event.payload.taskId;
        const existing = views.get(taskId);

        if (event.eventType === "task_created") {
            if (
                existing ||
                typeof taskId !== "string" ||
                event.payload.version !== 1 ||
                !Number.isInteger(event.payload.technicalRequirementVersion) ||
                event.payload.technicalRequirementVersion < 1 ||
                !acceptanceCriteriaAreValid(event.payload.acceptanceCriteria)
            ) {
                throw createCorruptionError();
            }

            views.set(taskId, {
                approvedVersion: null,
                checks: [],
                createdAt: event.occurredAt,
                currentVersion: 1,
                decision: null,
                executions: [],
                executionProposals: [],
                id: taskId,
                status: "draft",
                technicalRequirementId: event.requirementId,
                technicalRequirementVersion: event.payload.technicalRequirementVersion,
                timeline: [{
                    actor: event.actor,
                    eventType: event.eventType,
                    note: null,
                    occurredAt: event.occurredAt,
                    version: 1
                }],
                title: event.payload.title,
                updatedAt: event.occurredAt,
                versions: [createVersion(event)]
            });
            continue;
        }

        if (!existing || event.requirementId !== existing.technicalRequirementId) {
            throw createCorruptionError();
        }

        if (event.eventType === "task_revised") {
            if (
                (existing.status !== "draft" && existing.status !== "rejected") ||
                event.payload.version !== existing.currentVersion + 1 ||
                !acceptanceCriteriaAreValid(event.payload.acceptanceCriteria)
            ) {
                throw createCorruptionError();
            }

            existing.currentVersion = event.payload.version;
            existing.decision = null;
            existing.status = "draft";
            existing.title = event.payload.title;
            existing.updatedAt = event.occurredAt;
            existing.versions.push(createVersion(event));
        } else if (event.eventType === "task_review_submitted") {
            if (existing.status !== "draft" || event.payload.version !== existing.currentVersion) {
                throw createCorruptionError();
            }

            existing.status = "in_review";
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "task_decided") {
            if (
                existing.status !== "in_review" ||
                event.payload.version !== existing.currentVersion ||
                (event.payload.decision !== "approved" && event.payload.decision !== "rejected")
            ) {
                throw createCorruptionError();
            }

            existing.status = event.payload.decision;
            existing.approvedVersion = event.payload.decision === "approved" ? existing.currentVersion : existing.approvedVersion;
            existing.decision = {
                actor: event.actor,
                decidedAt: event.occurredAt,
                note: event.payload.note,
                value: event.payload.decision
            };
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "task_check_evaluated") {
            if (!readinessCheckIsValid(event, existing)) {
                throw createCorruptionError();
            }

            existing.checks.push({
                actor: event.actor,
                checkId: event.payload.checkId,
                checkedAt: event.occurredAt,
                consequence: event.payload.consequence,
                rules: event.payload.rules.map(function (rule) {
                    return {...rule};
                }),
                status: event.payload.status,
                version: event.payload.version
            });
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "task_execution_proposed") {
            if (!executionProposalIsValid(event, existing)) {
                throw createCorruptionError();
            }

            existing.executionProposals.push({
                actor: event.actor,
                createdAt: event.occurredAt,
                proposal: event.payload.proposal,
                version: event.payload.version
            });
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "task_execution_authorized") {
            if (!executionAuthorizationIsValid(event, existing)) {
                throw createCorruptionError();
            }

            existing.executions.push({
                authorizedAt: event.occurredAt,
                authorizedBy: event.actor,
                candidate: null,
                failure: null,
                id: event.payload.executionId,
                note: event.payload.note,
                proposalCreatedAt: event.payload.proposalCreatedAt,
                status: "running",
                version: event.payload.version
            });
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "task_execution_candidate_created") {
            const execution = existing.executions.find(function (item) {
                return item.id === event.payload.executionId;
            });

            if (!executionCandidateIsValid(event, existing, execution)) {
                throw createCorruptionError();
            }

            execution.candidate = {
                artifact: event.payload.artifact,
                bytes: event.payload.bytes,
                changedFiles: [...event.payload.changedFiles],
                createdAt: event.occurredAt,
                patchSha256: event.payload.patchSha256,
                sourceRevision: event.payload.sourceRevision,
                summary: event.payload.summary,
                validationNotes: [...event.payload.validationNotes]
            };
            execution.status = "awaiting_review";
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "task_execution_failed") {
            const execution = existing.executions.find(function (item) {
                return item.id === event.payload.executionId;
            });

            if (!executionFailureIsValid(event, existing, execution)) {
                throw createCorruptionError();
            }

            execution.failure = {
                code: event.payload.code,
                failedAt: event.occurredAt
            };
            execution.status = "failed";
            existing.updatedAt = event.occurredAt;
        } else {
            throw createCorruptionError();
        }

        existing.timeline.push({
            actor: event.actor,
            eventType: event.eventType,
            note: event.payload.note || null,
            occurredAt: event.occurredAt,
            version: event.payload.version
        });
    }

    return Array.from(views.values()).sort(function (left, right) {
        return right.updatedAt.localeCompare(left.updatedAt);
    });
};
