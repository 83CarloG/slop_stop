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
                createdAt: event.occurredAt,
                currentVersion: 1,
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

        if (
            !existing ||
            event.requirementId !== existing.technicalRequirementId ||
            event.payload.version !== existing.currentVersion + 1 ||
            !acceptanceCriteriaAreValid(event.payload.acceptanceCriteria)
        ) {
            throw createCorruptionError();
        }

        if (event.eventType === "task_revised") {
            existing.currentVersion = event.payload.version;
            existing.title = event.payload.title;
            existing.updatedAt = event.occurredAt;
            existing.versions.push(createVersion(event));
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

