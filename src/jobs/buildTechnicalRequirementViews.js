"use strict";

function createCorruptionError() {
    const error = new Error("The technical requirement event history is inconsistent.");
    error.code = "STORE_CORRUPTED";
    return error;
}

function createVersion(event) {
    return {
        actor: event.actor,
        createdAt: event.occurredAt,
        note: event.payload.note || null,
        statement: event.payload.statement,
        title: event.payload.title,
        version: event.payload.version
    };
}

module.exports = function buildTechnicalRequirementViews(events) {
    const views = new Map();

    for (const event of events) {
        if (!event.eventType.startsWith("technical_requirement_")) {
            continue;
        }

        const existing = views.get(event.requirementId);

        if (event.eventType === "technical_requirement_created") {
            if (
                existing ||
                event.payload.version !== 1 ||
                typeof event.payload.functionalRequirementId !== "string" ||
                !Number.isInteger(event.payload.functionalRequirementVersion) ||
                event.payload.functionalRequirementVersion < 1
            ) {
                throw createCorruptionError();
            }

            views.set(event.requirementId, {
                approvedVersion: null,
                createdAt: event.occurredAt,
                currentVersion: 1,
                decision: null,
                functionalRequirementId: event.payload.functionalRequirementId,
                functionalRequirementVersion: event.payload.functionalRequirementVersion,
                id: event.requirementId,
                status: "draft",
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

        if (!existing) {
            throw createCorruptionError();
        }

        if (event.eventType === "technical_requirement_revised") {
            if (
                (existing.status !== "draft" && existing.status !== "rejected") ||
                event.payload.version !== existing.currentVersion + 1
            ) {
                throw createCorruptionError();
            }

            existing.currentVersion = event.payload.version;
            existing.decision = null;
            existing.status = "draft";
            existing.title = event.payload.title;
            existing.updatedAt = event.occurredAt;
            existing.versions.push(createVersion(event));
        } else if (event.eventType === "technical_requirement_review_submitted") {
            if (existing.status !== "draft" || event.payload.version !== existing.currentVersion) {
                throw createCorruptionError();
            }

            existing.status = "in_review";
            existing.updatedAt = event.occurredAt;
        } else if (event.eventType === "technical_requirement_decided") {
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

