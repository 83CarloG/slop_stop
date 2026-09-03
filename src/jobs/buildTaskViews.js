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
        payload.consequence === (derivedStatus === "passed" ? "allow" : "stop");
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
