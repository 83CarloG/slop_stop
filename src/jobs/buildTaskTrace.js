"use strict";

const labels = {
    ai_review_proposed: "Codex review proposed",
    functional_requirement_created: "Functional draft created",
    functional_requirement_decided: "Functional decision recorded",
    functional_requirement_revised: "Functional revision created",
    functional_requirement_review_submitted: "Functional requirement submitted for review",
    task_created: "Task draft created",
    task_check_evaluated: "Task readiness check evaluated",
    task_decided: "Task decision recorded",
    task_execution_authorized: "Isolated execution authorized",
    task_execution_candidate_created: "Implementation candidate created",
    task_execution_failed: "Isolated execution failed",
    task_execution_proposed: "Codex execution proposal recorded",
    task_revised: "Task revision created",
    task_review_submitted: "Task submitted for review",
    technical_requirement_created: "Technical draft created",
    technical_requirement_decided: "Technical decision recorded",
    technical_requirement_revised: "Technical revision created",
    technical_requirement_review_submitted: "Technical requirement submitted for review"
};

function createCorruptionError() {
    const error = new Error("The task process trace is inconsistent.");
    error.code = "STORE_CORRUPTED";
    return error;
}

function findVersion(subject, version) {
    return subject.versions.find(function (item) {
        return item.version === version;
    });
}

function createChainItem(subject, kind, version) {
    const exactVersion = findVersion(subject, version);

    if (!exactVersion) {
        throw createCorruptionError();
    }

    return {
        id: subject.id,
        kind,
        status: subject.status,
        title: exactVersion.title,
        version
    };
}

function identifySubject(event, input) {
    if (event.eventType.startsWith("functional_requirement_") || event.eventType === "ai_review_proposed") {
        return {kind: "functionalRequirement", view: input.functionalRequirement};
    }

    if (event.eventType.startsWith("technical_requirement_")) {
        return {kind: "technicalRequirement", view: input.technicalRequirement};
    }

    return {kind: "task", view: input.task};
}

function eventBelongsToTrace(event, input) {
    if (event.requirementId === input.functionalRequirement.id) {
        return event.eventType.startsWith("functional_requirement_") || event.eventType === "ai_review_proposed";
    }

    if (event.requirementId !== input.technicalRequirement.id) {
        return false;
    }

    if (event.eventType.startsWith("technical_requirement_")) {
        return true;
    }

    return event.eventType.startsWith("task_") && event.payload.taskId === input.task.id;
}

module.exports = function buildTaskTrace(input) {
    if (
        input.task.technicalRequirementId !== input.technicalRequirement.id ||
        input.technicalRequirement.functionalRequirementId !== input.functionalRequirement.id ||
        input.technicalRequirement.approvedVersion !== input.task.technicalRequirementVersion ||
        input.functionalRequirement.approvedVersion !== input.technicalRequirement.functionalRequirementVersion
    ) {
        throw createCorruptionError();
    }

    const chain = {
        functionalRequirement: createChainItem(
            input.functionalRequirement,
            "functionalRequirement",
            input.technicalRequirement.functionalRequirementVersion
        ),
        technicalRequirement: createChainItem(
            input.technicalRequirement,
            "technicalRequirement",
            input.task.technicalRequirementVersion
        ),
        task: createChainItem(input.task, "task", input.task.currentVersion)
    };

    const timeline = input.events.map(function (event, index) {
        return {event, index};
    }).filter(function (entry) {
        return eventBelongsToTrace(entry.event, input);
    }).sort(function (left, right) {
        return left.event.occurredAt.localeCompare(right.event.occurredAt) || left.index - right.index;
    }).map(function (entry) {
        const event = entry.event;
        const subject = identifySubject(event, input);
        const subjectVersion = findVersion(subject.view, event.payload.version);

        if (!labels[event.eventType] || !subjectVersion) {
            throw createCorruptionError();
        }

        const timelineEvent = {
            actor: {
                kind: event.actor.kind,
                name: event.actor.name
            },
            eventType: event.eventType,
            label: labels[event.eventType],
            note: event.payload.note || null,
            occurredAt: event.occurredAt,
            subject: {
                id: subject.view.id,
                kind: subject.kind,
                title: subjectVersion.title,
                version: event.payload.version
            }
        };

        if (event.eventType === "task_check_evaluated") {
            timelineEvent.result = {
                checkId: event.payload.checkId,
                consequence: event.payload.consequence,
                status: event.payload.status
            };
        }

        return timelineEvent;
    });

    return {
        chain,
        taskId: input.task.id,
        timeline
    };
};
