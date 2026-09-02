"use strict";

const applicationStatus = document.querySelector("#application-status");
const actorNameInput = document.querySelector("#actor-name");
const aiReviewList = document.querySelector("#ai-review-list");
const approveRequirementButton = document.querySelector("#approve-requirement");
const codexStatus = document.querySelector("#codex-status");
const codexSmokeButton = document.querySelector("#codex-smoke");
const codexResult = document.querySelector("#codex-result");
const rejectRequirementButton = document.querySelector("#reject-requirement");
const requestAiReviewButton = document.querySelector("#request-ai-review");
const requirementDetail = document.querySelector("#requirement-detail");
const requirementDetailSource = document.querySelector("#requirement-detail-source");
const requirementDetailStatus = document.querySelector("#requirement-detail-status");
const requirementDetailTitle = document.querySelector("#requirement-detail-title");
const requirementDetailVersion = document.querySelector("#requirement-detail-version");
const requirementForm = document.querySelector("#requirement-form");
const requirementList = document.querySelector("#requirement-list");
const requirementMessage = document.querySelector("#requirement-message");
const requirementSourceInput = document.querySelector("#requirement-source");
const requirementStatementInput = document.querySelector("#requirement-statement");
const requirementTimeline = document.querySelector("#requirement-timeline");
const requirementTitleInput = document.querySelector("#requirement-title");
const requirementVersions = document.querySelector("#requirement-versions");
const reviseRequirementButton = document.querySelector("#revise-requirement");
const revisionNoteInput = document.querySelector("#revision-note");
const revisionStatementInput = document.querySelector("#revision-statement");
const revisionTitleInput = document.querySelector("#revision-title");
const submitRequirementButton = document.querySelector("#submit-requirement");

let selectedRequirementId = null;
let selectedRequirement = null;
let codexReady = false;

async function readJson(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "The request failed.");
    }

    return data;
}

function getActorName() {
    const actorName = actorNameInput.value.trim();

    if (!actorName) {
        throw new Error("Enter the human actor display name first.");
    }

    return actorName;
}

function rememberActorName() {
    try {
        window.localStorage.setItem("slopStopActorName", actorNameInput.value.trim());
    } catch (error) {
        // Browser storage is a convenience only and never canonical evidence.
    }
}

function restoreActorName() {
    try {
        actorNameInput.value = window.localStorage.getItem("slopStopActorName") || "";
    } catch (error) {
        actorNameInput.value = "";
    }
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    return await readJson(response);
}

function createTimelineText(event) {
    const labels = {
        functional_requirement_created: "Draft created",
        functional_requirement_decided: "Human decision recorded",
        functional_requirement_revised: "Revision created",
        functional_requirement_review_submitted: "Submitted for review",
        ai_review_proposed: "Codex review proposed"
    };
    const note = event.note ? ` — ${event.note}` : "";
    return `${labels[event.eventType] || event.eventType} by ${event.actor.name} at ${event.occurredAt}${note}`;
}

function renderRequirement(requirement) {
    const currentVersion = requirement.versions.find(function (version) {
        return version.version === requirement.currentVersion;
    });

    selectedRequirement = requirement;
    requirementDetail.hidden = false;
    requirementDetailStatus.textContent = requirement.status.toUpperCase();
    requirementDetailTitle.textContent = requirement.title;
    requirementDetailVersion.textContent = `Version ${requirement.currentVersion}`;
    requirementDetailSource.textContent = `Origin: ${requirement.source}`;
    revisionTitleInput.value = currentVersion.title;
    revisionStatementInput.value = currentVersion.statement;
    revisionNoteInput.value = "";

    reviseRequirementButton.disabled = requirement.status !== "draft" && requirement.status !== "rejected";
    submitRequirementButton.disabled = requirement.status !== "draft";
    approveRequirementButton.disabled = requirement.status !== "in_review";
    rejectRequirementButton.disabled = requirement.status !== "in_review";
    requestAiReviewButton.disabled = requirement.status !== "draft" || !codexReady;

    aiReviewList.replaceChildren();
    for (const proposal of requirement.aiReviews) {
        const container = document.createElement("div");
        const heading = document.createElement("h5");
        const summary = document.createElement("p");
        const missingHeading = document.createElement("strong");
        const missingList = document.createElement("ul");
        const ambiguityHeading = document.createElement("strong");
        const ambiguityList = document.createElement("ul");
        const suggestion = document.createElement("p");
        const useButton = document.createElement("button");

        container.className = "ai-review";
        heading.textContent = `Version ${proposal.version} review by ${proposal.actor.name}`;
        summary.textContent = proposal.review.summary;
        missingHeading.textContent = "Missing information";
        for (const item of proposal.review.missingInformation) {
            const listItem = document.createElement("li");
            listItem.textContent = item;
            missingList.append(listItem);
        }
        ambiguityHeading.textContent = "Ambiguities";
        for (const item of proposal.review.ambiguities) {
            const listItem = document.createElement("li");
            listItem.textContent = item;
            ambiguityList.append(listItem);
        }
        suggestion.textContent = `Suggested revision: ${proposal.review.suggestedRevision.title} — ${proposal.review.suggestedRevision.statement}`;
        useButton.type = "button";
        useButton.textContent = "Use suggestion in revision fields";
        useButton.disabled = requirement.status !== "draft" || proposal.version !== requirement.currentVersion;
        useButton.addEventListener("click", function () {
            revisionTitleInput.value = proposal.review.suggestedRevision.title;
            revisionStatementInput.value = proposal.review.suggestedRevision.statement;
            revisionNoteInput.focus();
        });

        container.append(heading, summary, missingHeading, missingList, ambiguityHeading, ambiguityList, suggestion, useButton);
        aiReviewList.append(container);
    }

    requirementVersions.replaceChildren();
    for (const version of requirement.versions) {
        const item = document.createElement("li");
        item.textContent = `Version ${version.version}: ${version.title} — ${version.actor.name} at ${version.createdAt}${version.note ? ` — ${version.note}` : ""}`;
        requirementVersions.append(item);
    }

    requirementTimeline.replaceChildren();
    for (const event of requirement.timeline) {
        const item = document.createElement("li");
        item.textContent = createTimelineText(event);
        requirementTimeline.append(item);
    }
}

async function loadRequirement(requirementId) {
    const requirement = await requestJson(`/api/functional-requirements/${requirementId}`);
    selectedRequirementId = requirement.id;
    renderRequirement(requirement);
}

async function loadRequirements() {
    const result = await requestJson("/api/functional-requirements");
    requirementList.replaceChildren();

    for (const requirement of result.items) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "requirement-link";
        button.textContent = `${requirement.title} — ${requirement.status} — v${requirement.currentVersion}`;
        button.addEventListener("click", async function () {
            try {
                await loadRequirement(requirement.id);
                requirementMessage.textContent = "";
            } catch (error) {
                requirementMessage.textContent = error.message;
            }
        });
        item.append(button);
        requirementList.append(item);
    }

    if (selectedRequirementId) {
        const selectedStillExists = result.items.some(function (requirement) {
            return requirement.id === selectedRequirementId;
        });

        if (selectedStillExists) {
            await loadRequirement(selectedRequirementId);
        }
    }
}

async function performRequirementAction(url, createPayload, confirmationMessage) {
    try {
        const payload = createPayload();

        if (confirmationMessage && !window.confirm(confirmationMessage)) {
            return;
        }

        const requirement = await requestJson(url, {
            body: JSON.stringify(payload),
            headers: {"content-type": "application/json"},
            method: "POST"
        });
        selectedRequirementId = requirement.id;
        requirementMessage.textContent = "Requirement updated.";
        await loadRequirements();
    } catch (error) {
        requirementMessage.textContent = error.message;
    }
}

async function loadStatus() {
    try {
        const healthResponse = await fetch("/health");
        const health = await readJson(healthResponse);
        applicationStatus.textContent = health.status === "ok" ? "Application ready." : "Application unavailable.";
    } catch (error) {
        applicationStatus.textContent = "Application unavailable.";
    }

    try {
        const codexResponse = await fetch("/api/providers/codex");
        const status = await readJson(codexResponse);

        if (status.available && status.authenticated) {
            codexReady = true;
            codexStatus.textContent = `Ready: ${status.version || "version unavailable"}`;
            codexSmokeButton.disabled = false;
        } else if (status.available) {
            codexReady = false;
            codexStatus.textContent = "Codex CLI is available but not authenticated.";
        } else {
            codexReady = false;
            codexStatus.textContent = "Codex CLI is not available.";
        }
    } catch (error) {
        codexReady = false;
        codexStatus.textContent = "Codex status could not be checked.";
    }

    if (selectedRequirement) {
        requestAiReviewButton.disabled = selectedRequirement.status !== "draft" || !codexReady;
    }
}

codexSmokeButton.addEventListener("click", async function () {
    const confirmed = window.confirm("Run one real Codex request in read-only and ephemeral mode?");

    if (!confirmed) {
        return;
    }

    codexSmokeButton.disabled = true;
    codexResult.textContent = "Running Codex smoke test...";

    try {
        const response = await fetch("/api/providers/codex/smoke", {
            body: JSON.stringify({confirmed: true}),
            headers: {"content-type": "application/json"},
            method: "POST"
        });
        const result = await readJson(response);
        codexResult.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
        codexResult.textContent = error.message;
    } finally {
        codexSmokeButton.disabled = false;
    }
});

actorNameInput.addEventListener("change", rememberActorName);

requirementForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
        const requirement = await requestJson("/api/functional-requirements", {
            body: JSON.stringify({
                actorName: getActorName(),
                source: requirementSourceInput.value,
                statement: requirementStatementInput.value,
                title: requirementTitleInput.value
            }),
            headers: {"content-type": "application/json"},
            method: "POST"
        });

        rememberActorName();
        selectedRequirementId = requirement.id;
        requirementForm.reset();
        requirementMessage.textContent = "Draft created.";
        await loadRequirements();
    } catch (error) {
        requirementMessage.textContent = error.message;
    }
});

reviseRequirementButton.addEventListener("click", async function () {
    if (!selectedRequirementId) {
        return;
    }

    await performRequirementAction(`/api/functional-requirements/${selectedRequirementId}/revisions`, function () {
        return {
            actorName: getActorName(),
            note: revisionNoteInput.value,
            statement: revisionStatementInput.value,
            title: revisionTitleInput.value
        };
    });
});

submitRequirementButton.addEventListener("click", async function () {
    if (!selectedRequirementId) {
        return;
    }

    await performRequirementAction(`/api/functional-requirements/${selectedRequirementId}/review`, function () {
        return {
            actorName: getActorName()
        };
    }, "Submit this draft for human review?");
});

approveRequirementButton.addEventListener("click", async function () {
    if (!selectedRequirementId) {
        return;
    }

    await performRequirementAction(`/api/functional-requirements/${selectedRequirementId}/decisions`, function () {
        return {
            actorName: getActorName(),
            decision: "approved",
            note: revisionNoteInput.value
        };
    }, "Approve this immutable requirement version?");
});

rejectRequirementButton.addEventListener("click", async function () {
    if (!selectedRequirementId) {
        return;
    }

    await performRequirementAction(`/api/functional-requirements/${selectedRequirementId}/decisions`, function () {
        return {
            actorName: getActorName(),
            decision: "rejected",
            note: revisionNoteInput.value
        };
    }, "Reject this requirement version?");
});

requestAiReviewButton.addEventListener("click", async function () {
    if (!selectedRequirementId || !selectedRequirement || selectedRequirement.status !== "draft") {
        return;
    }

    const confirmed = window.confirm(
        "Send the current title, origin, and statement to Codex for a read-only review? Codex will only propose changes."
    );

    if (!confirmed) {
        return;
    }

    requestAiReviewButton.disabled = true;
    requirementMessage.textContent = "Requesting a Codex proposal...";

    try {
        const requirement = await requestJson(`/api/functional-requirements/${selectedRequirementId}/ai-reviews`, {
            body: JSON.stringify({confirmed: true}),
            headers: {"content-type": "application/json"},
            method: "POST"
        });
        selectedRequirement = requirement;
        requirementMessage.textContent = "Codex proposal recorded. No requirement content or status changed.";
        await loadRequirements();
    } catch (error) {
        requirementMessage.textContent = error.message;
        requestAiReviewButton.disabled = selectedRequirement.status !== "draft" || !codexReady;
    }
});

restoreActorName();
loadStatus();
loadRequirements().catch(function (error) {
    requirementMessage.textContent = error.message;
});
