"use strict";

const applicationStatus = document.querySelector("#application-status");
const actorNameInput = document.querySelector("#actor-name");
const aiReviewList = document.querySelector("#ai-review-list");
const approveRequirementButton = document.querySelector("#approve-requirement");
const approveTaskButton = document.querySelector("#approve-task");
const codexStatus = document.querySelector("#codex-status");
const codexSmokeButton = document.querySelector("#codex-smoke");
const codexResult = document.querySelector("#codex-result");
const derivedTaskList = document.querySelector("#derived-task-list");
const derivedTechnicalList = document.querySelector("#derived-technical-list");
const documentTree = document.querySelector("#document-tree");
const processDetail = document.querySelector("#process-detail");
const processEmpty = document.querySelector("#process-empty");
const processTraceTimeline = document.querySelector("#process-trace-timeline");
const rejectRequirementButton = document.querySelector("#reject-requirement");
const rejectTaskButton = document.querySelector("#reject-task");
const runTaskReadinessCheckButton = document.querySelector("#run-task-readiness-check");
const requestAiReviewButton = document.querySelector("#request-ai-review");
const requirementDetail = document.querySelector("#requirement-detail");
const requirementDetailSource = document.querySelector("#requirement-detail-source");
const requirementDetailStatus = document.querySelector("#requirement-detail-status");
const requirementDetailTitle = document.querySelector("#requirement-detail-title");
const requirementDetailVersion = document.querySelector("#requirement-detail-version");
const requirementForm = document.querySelector("#requirement-form");
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
const submitTaskButton = document.querySelector("#submit-task");
const approveTechnicalRequirementButton = document.querySelector("#approve-technical-requirement");
const rejectTechnicalRequirementButton = document.querySelector("#reject-technical-requirement");
const reviseTechnicalRequirementButton = document.querySelector("#revise-technical-requirement");
const submitTechnicalRequirementButton = document.querySelector("#submit-technical-requirement");
const technicalDetail = document.querySelector("#technical-detail");
const technicalDetailStatus = document.querySelector("#technical-detail-status");
const technicalDetailTitle = document.querySelector("#technical-detail-title");
const technicalDetailVersion = document.querySelector("#technical-detail-version");
const technicalForm = document.querySelector("#technical-requirement-form");
const technicalMessage = document.querySelector("#technical-message");
const technicalOriginInput = document.querySelector("#technical-origin");
const technicalOriginLink = document.querySelector("#technical-origin-link");
const technicalRevisionNoteInput = document.querySelector("#technical-revision-note");
const technicalRevisionStatementInput = document.querySelector("#technical-revision-statement");
const technicalRevisionTitleInput = document.querySelector("#technical-revision-title");
const technicalStatementInput = document.querySelector("#technical-statement");
const technicalTimeline = document.querySelector("#technical-timeline");
const technicalTitleInput = document.querySelector("#technical-title");
const technicalVersions = document.querySelector("#technical-versions");
const reviseTaskButton = document.querySelector("#revise-task");
const taskCriteriaInput = document.querySelector("#task-criteria");
const taskDetail = document.querySelector("#task-detail");
const taskDetailStatus = document.querySelector("#task-detail-status");
const taskDetailTitle = document.querySelector("#task-detail-title");
const taskDetailVersion = document.querySelector("#task-detail-version");
const taskForm = document.querySelector("#task-form");
const taskMessage = document.querySelector("#task-message");
const taskObjectiveInput = document.querySelector("#task-objective");
const taskOriginInput = document.querySelector("#task-origin");
const taskOriginLink = document.querySelector("#task-origin-link");
const taskRevisionCriteriaInput = document.querySelector("#task-revision-criteria");
const taskRevisionNoteInput = document.querySelector("#task-revision-note");
const taskRevisionObjectiveInput = document.querySelector("#task-revision-objective");
const taskRevisionTitleInput = document.querySelector("#task-revision-title");
const taskReadinessRules = document.querySelector("#task-readiness-rules");
const taskReadinessSummary = document.querySelector("#task-readiness-summary");
const taskTitleInput = document.querySelector("#task-title");
const taskVersions = document.querySelector("#task-versions");
const traceFunctionalLink = document.querySelector("#trace-functional-link");
const traceTaskCurrent = document.querySelector("#trace-task-current");
const traceTechnicalLink = document.querySelector("#trace-technical-link");
const viewProcessButton = document.querySelector("#view-process");
const workspacePanels = Array.from(document.querySelectorAll("[data-panel]"));
const workspaceTabs = Array.from(document.querySelectorAll("[role=tab][data-tab]"));

let selectedRequirementId = null;
let selectedRequirement = null;
let selectedTechnicalRequirementId = null;
let selectedTechnicalRequirement = null;
let selectedTaskId = null;
let selectedTask = null;
let selectedTaskTrace = null;
let functionalRequirements = [];
let technicalRequirements = [];
let tasks = [];
let activeDocument = null;
let codexReady = false;
const collapsedTreeNodes = new Set();

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

function activateTab(tabName, focusTab = false) {
    for (const tab of workspaceTabs) {
        const isActive = tab.dataset.tab === tabName;
        tab.setAttribute("aria-selected", String(isActive));
        tab.tabIndex = isActive ? 0 : -1;

        if (isActive && focusTab) {
            tab.focus();
        }
    }

    for (const panel of workspacePanels) {
        panel.hidden = panel.dataset.panel !== tabName;
    }
}

function moveTabFocus(currentTab, key) {
    const currentIndex = workspaceTabs.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % workspaceTabs.length;
    } else if (key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + workspaceTabs.length) % workspaceTabs.length;
    } else if (key === "Home") {
        nextIndex = 0;
    } else if (key === "End") {
        nextIndex = workspaceTabs.length - 1;
    } else {
        return;
    }

    workspaceTabs[nextIndex].focus();
}

function parseAcceptanceCriteria(value) {
    return value.split(/\r?\n/u).map(function (item) {
        return item.trim();
    }).filter(function (item) {
        return item !== "";
    });
}

function createTimelineText(event) {
    const labels = {
        functional_requirement_created: "Draft created",
        functional_requirement_decided: "Human decision recorded",
        functional_requirement_revised: "Revision created",
        functional_requirement_review_submitted: "Submitted for review",
        task_created: "Task draft created",
        task_check_evaluated: "Task readiness check evaluated",
        task_decided: "Task decision recorded",
        task_revised: "Task revision created",
        task_review_submitted: "Task submitted for review",
        technical_requirement_created: "Technical draft created",
        technical_requirement_decided: "Technical decision recorded",
        technical_requirement_revised: "Technical revision created",
        technical_requirement_review_submitted: "Technical requirement submitted for review",
        ai_review_proposed: "Codex review proposed"
    };
    const result = event.result ? ` — ${event.result.status} · ${event.result.consequence.replace(/_/gu, " ")}` : "";
    const note = event.note ? ` — ${event.note}` : "";
    return `${event.label || labels[event.eventType] || event.eventType} by ${event.actor.name} at ${event.occurredAt}${result}${note}`;
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

function createRequirementListButton(requirement, clickHandler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "requirement-link";
    button.textContent = `${requirement.title} — ${requirement.status} — v${requirement.currentVersion}`;
    button.addEventListener("click", clickHandler);
    return button;
}

function getActiveDocumentPath() {
    if (!activeDocument) {
        return [];
    }

    if (activeDocument.type === "functional") {
        return [{id: activeDocument.id, type: "functional"}];
    }

    if (activeDocument.type === "technical") {
        const technicalRequirement = technicalRequirements.find(function (item) {
            return item.id === activeDocument.id;
        });

        return technicalRequirement ? [
            {id: technicalRequirement.functionalRequirementId, type: "functional"},
            {id: technicalRequirement.id, type: "technical"}
        ] : [];
    }

    const task = tasks.find(function (item) {
        return item.id === activeDocument.id;
    });
    const technicalRequirement = task && technicalRequirements.find(function (item) {
        return item.id === task.technicalRequirementId;
    });

    return task && technicalRequirement ? [
        {id: technicalRequirement.functionalRequirementId, type: "functional"},
        {id: technicalRequirement.id, type: "technical"},
        {id: task.id, type: "task"}
    ] : [];
}

function setActiveDocument(type, id) {
    activeDocument = {id, type};

    for (const item of getActiveDocumentPath()) {
        collapsedTreeNodes.delete(`${item.type}:${item.id}`);
    }
}

async function openDocument(type, id) {
    const panelByType = {
        functional: "functional",
        task: "tasks",
        technical: "technical"
    };
    const messageByType = {
        functional: requirementMessage,
        task: taskMessage,
        technical: technicalMessage
    };

    activateTab(panelByType[type]);

    try {
        if (type === "functional") {
            await loadRequirement(id);
        } else if (type === "technical") {
            await loadTechnicalRequirement(id);
        } else {
            await loadTask(id);
        }

        messageByType[type].textContent = "";
        document.querySelector(`[data-panel="${panelByType[type]}"]`).focus();
    } catch (error) {
        messageByType[type].textContent = error.message;
    }
}

function createTreeNode(documentItem, type, children) {
    const item = document.createElement("li");
    const row = document.createElement("div");
    const collapseKey = `${type}:${documentItem.id}`;
    const activePath = getActiveDocumentPath();
    const isCurrent = activeDocument && activeDocument.type === type && activeDocument.id === documentItem.id;
    const isInActivePath = activePath.some(function (pathItem) {
        return pathItem.type === type && pathItem.id === documentItem.id;
    });

    item.className = `tree-node tree-node-${type}`;
    row.className = "tree-row";

    if (children.length > 0) {
        const toggle = document.createElement("button");
        const childList = document.createElement("ul");
        const isExpanded = !collapsedTreeNodes.has(collapseKey);

        toggle.type = "button";
        toggle.className = "tree-toggle";
        toggle.setAttribute("aria-expanded", String(isExpanded));
        toggle.setAttribute("aria-label", `${isExpanded ? "Collapse" : "Expand"} children of ${documentItem.title}`);
        toggle.textContent = isExpanded ? "▾" : "▸";
        childList.id = `tree-children-${type}-${documentItem.id}`;
        childList.className = "tree-children";
        childList.hidden = !isExpanded;
        toggle.setAttribute("aria-controls", childList.id);

        for (const child of children) {
            childList.append(child);
        }

        toggle.addEventListener("click", function () {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!expanded));
            toggle.setAttribute("aria-label", `${expanded ? "Expand" : "Collapse"} children of ${documentItem.title}`);
            toggle.textContent = expanded ? "▸" : "▾";
            childList.hidden = expanded;

            if (expanded) {
                collapsedTreeNodes.add(collapseKey);
            } else {
                collapsedTreeNodes.delete(collapseKey);
            }
        });

        row.append(toggle);
        item.append(row, childList);
    } else {
        const spacer = document.createElement("span");
        spacer.className = "tree-toggle-spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.append(spacer);
        item.append(row);
    }

    const button = document.createElement("button");
    const title = document.createElement("span");
    const metadata = document.createElement("span");

    button.type = "button";
    button.className = "tree-document";
    button.dataset.documentId = documentItem.id;
    button.dataset.documentType = type;
    button.setAttribute("aria-current", isCurrent ? "page" : "false");
    button.setAttribute("aria-label", `${type} document ${documentItem.title}, ${documentItem.status}, version ${documentItem.currentVersion}`);
    title.className = "tree-document-title";
    title.textContent = documentItem.title;
    metadata.className = `tree-document-meta status-${documentItem.status}`;
    metadata.textContent = `${documentItem.status} · v${documentItem.currentVersion}`;
    button.append(title, metadata);
    button.addEventListener("click", async function () {
        await openDocument(type, documentItem.id);
    });

    if (isInActivePath) {
        item.classList.add(isCurrent ? "is-current" : "is-ancestor");
    }

    row.append(button);
    return item;
}

function renderDocumentTree() {
    const root = document.createElement("ul");
    root.className = "document-tree-list";
    documentTree.replaceChildren();

    if (functionalRequirements.length === 0) {
        const empty = document.createElement("p");
        empty.className = "hint";
        empty.textContent = "No documents yet.";
        documentTree.append(empty);
        return;
    }

    for (const functionalRequirement of functionalRequirements) {
        const technicalNodes = technicalRequirements.filter(function (technicalRequirement) {
            return technicalRequirement.functionalRequirementId === functionalRequirement.id;
        }).map(function (technicalRequirement) {
            const taskNodes = tasks.filter(function (task) {
                return task.technicalRequirementId === technicalRequirement.id;
            }).map(function (task) {
                return createTreeNode(task, "task", []);
            });

            return createTreeNode(technicalRequirement, "technical", taskNodes);
        });

        root.append(createTreeNode(functionalRequirement, "functional", technicalNodes));
    }

    documentTree.append(root);
}

async function loadDerivedTechnicalRequirements(functionalRequirementId) {
    const result = await requestJson(`/api/technical-requirements?functionalRequirementId=${functionalRequirementId}`);
    derivedTechnicalList.replaceChildren();

    if (result.items.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.textContent = "No technical requirements derive from this functional requirement yet.";
        derivedTechnicalList.append(emptyItem);
        return;
    }

    for (const requirement of result.items) {
        const item = document.createElement("li");
        const button = createRequirementListButton(requirement, async function () {
            try {
                activateTab("technical");
                await loadTechnicalRequirement(requirement.id);
                technicalMessage.textContent = "";
                technicalDetail.scrollIntoView({behavior: "smooth", block: "start"});
            } catch (error) {
                technicalMessage.textContent = error.message;
            }
        });
        item.append(button);
        derivedTechnicalList.append(item);
    }
}

function renderTechnicalRequirement(requirement) {
    const currentVersion = requirement.versions.find(function (version) {
        return version.version === requirement.currentVersion;
    });
    const origin = functionalRequirements.find(function (item) {
        return item.id === requirement.functionalRequirementId;
    });
    const originTitle = origin ? origin.title : requirement.functionalRequirementId;

    selectedTechnicalRequirement = requirement;
    technicalDetail.hidden = false;
    technicalDetailStatus.textContent = requirement.status.toUpperCase();
    technicalDetailTitle.textContent = requirement.title;
    technicalDetailVersion.textContent = `Version ${requirement.currentVersion}`;
    technicalOriginLink.textContent = `Functional origin: ${originTitle} — approved v${requirement.functionalRequirementVersion}`;
    technicalRevisionTitleInput.value = currentVersion.title;
    technicalRevisionStatementInput.value = currentVersion.statement;
    technicalRevisionNoteInput.value = "";

    reviseTechnicalRequirementButton.disabled = requirement.status !== "draft" && requirement.status !== "rejected";
    submitTechnicalRequirementButton.disabled = requirement.status !== "draft";
    approveTechnicalRequirementButton.disabled = requirement.status !== "in_review";
    rejectTechnicalRequirementButton.disabled = requirement.status !== "in_review";

    technicalVersions.replaceChildren();
    for (const version of requirement.versions) {
        const item = document.createElement("li");
        item.textContent = `Version ${version.version}: ${version.title} — ${version.actor.name} at ${version.createdAt}${version.note ? ` — ${version.note}` : ""}`;
        technicalVersions.append(item);
    }

    technicalTimeline.replaceChildren();
    for (const event of requirement.timeline) {
        const item = document.createElement("li");
        item.textContent = createTimelineText(event);
        technicalTimeline.append(item);
    }
}

async function loadTechnicalRequirement(requirementId) {
    const requirement = await requestJson(`/api/technical-requirements/${requirementId}`);
    selectedTechnicalRequirementId = requirement.id;
    setActiveDocument("technical", requirement.id);
    renderTechnicalRequirement(requirement);
    taskOriginInput.value = requirement.status === "approved" ? requirement.id : "";
    await loadDerivedTasks(requirement.id);
    renderDocumentTree();
}

async function loadDerivedTasks(technicalRequirementId) {
    const result = await requestJson(`/api/tasks?technicalRequirementId=${technicalRequirementId}`);
    derivedTaskList.replaceChildren();

    if (result.items.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.textContent = "No tasks derive from this technical requirement yet.";
        derivedTaskList.append(emptyItem);
        return;
    }

    for (const task of result.items) {
        const item = document.createElement("li");
        const button = createRequirementListButton(task, async function () {
            try {
                activateTab("tasks");
                await loadTask(task.id);
                taskMessage.textContent = "";
                taskDetail.scrollIntoView({behavior: "smooth", block: "start"});
            } catch (error) {
                taskMessage.textContent = error.message;
            }
        });
        item.append(button);
        derivedTaskList.append(item);
    }
}

function renderTask(task) {
    const currentVersion = task.versions.find(function (version) {
        return version.version === task.currentVersion;
    });
    const origin = technicalRequirements.find(function (item) {
        return item.id === task.technicalRequirementId;
    });
    const originTitle = origin ? origin.title : task.technicalRequirementId;

    selectedTask = task;
    taskDetail.hidden = false;
    taskDetailStatus.textContent = task.status.toUpperCase();
    taskDetailTitle.textContent = task.title;
    taskDetailVersion.textContent = `Version ${task.currentVersion}`;
    taskOriginLink.textContent = `Technical origin: ${originTitle} — approved v${task.technicalRequirementVersion}`;
    taskRevisionTitleInput.value = currentVersion.title;
    taskRevisionObjectiveInput.value = currentVersion.objective;
    taskRevisionCriteriaInput.value = currentVersion.acceptanceCriteria.join("\n");
    taskRevisionNoteInput.value = "";

    reviseTaskButton.disabled = task.status !== "draft" && task.status !== "rejected";
    submitTaskButton.disabled = task.status !== "draft";
    approveTaskButton.disabled = task.status !== "in_review";
    rejectTaskButton.disabled = task.status !== "in_review";

    taskReadinessRules.replaceChildren();
    const latestCheck = task.checks.at(-1);

    if (latestCheck) {
        const consequence = latestCheck.consequence.replace(/_/gu, " ").toUpperCase();
        taskReadinessSummary.textContent = `${latestCheck.checkId}: ${latestCheck.status.toUpperCase()} · ${consequence} — version ${latestCheck.version} at ${latestCheck.checkedAt}`;

        for (const rule of latestCheck.rules) {
            const item = document.createElement("li");
            item.textContent = `${rule.ruleId}: ${rule.status}`;
            taskReadinessRules.append(item);
        }
    } else {
        taskReadinessSummary.textContent = "No readiness check recorded.";
    }

    taskVersions.replaceChildren();
    for (const version of task.versions) {
        const item = document.createElement("li");
        const note = version.note ? ` — ${version.note}` : "";
        item.textContent = `Version ${version.version}: ${version.title} — ${version.actor.name} at ${version.createdAt}${note}`;
        taskVersions.append(item);
    }
}

function renderTaskTrace(trace) {
    selectedTaskTrace = trace;
    processEmpty.hidden = true;
    processDetail.hidden = false;
    traceFunctionalLink.textContent = `Functional: ${trace.chain.functionalRequirement.title} — v${trace.chain.functionalRequirement.version}`;
    traceTechnicalLink.textContent = `Technical: ${trace.chain.technicalRequirement.title} — v${trace.chain.technicalRequirement.version}`;
    traceTaskCurrent.textContent = `Task: ${trace.chain.task.title} — v${trace.chain.task.version}`;

    processTraceTimeline.replaceChildren();
    for (const event of trace.timeline) {
        const item = document.createElement("li");
        item.textContent = createTimelineText(event);
        processTraceTimeline.append(item);
    }
}

async function loadTask(taskId) {
    const [task, trace] = await Promise.all([
        requestJson(`/api/tasks/${taskId}`),
        requestJson(`/api/tasks/${taskId}/trace`)
    ]);
    selectedTaskId = task.id;
    setActiveDocument("task", task.id);
    renderTask(task);
    renderTaskTrace(trace);
    renderDocumentTree();
}

function renderTaskOriginOptions() {
    const selectedValue = taskOriginInput.value;
    taskOriginInput.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an approved technical requirement";
    taskOriginInput.append(placeholder);

    for (const requirement of technicalRequirements.filter(function (item) {
        return item.status === "approved";
    })) {
        const option = document.createElement("option");
        option.value = requirement.id;
        option.textContent = `${requirement.title} — approved v${requirement.approvedVersion}`;
        taskOriginInput.append(option);
    }

    if (Array.from(taskOriginInput.options).some(function (option) {
        return option.value === selectedValue;
    })) {
        taskOriginInput.value = selectedValue;
    }
}

async function loadTasks() {
    const result = await requestJson("/api/tasks");
    tasks = result.items;

    if (selectedTaskId) {
        const selectedStillExists = result.items.some(function (task) {
            return task.id === selectedTaskId;
        });

        if (selectedStillExists) {
            await loadTask(selectedTaskId);
        }
    }

    if (selectedTechnicalRequirementId) {
        await loadDerivedTasks(selectedTechnicalRequirementId);
    }

    renderDocumentTree();
}

function renderTechnicalOriginOptions() {
    const selectedValue = technicalOriginInput.value;
    technicalOriginInput.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select an approved functional requirement";
    technicalOriginInput.append(placeholder);

    for (const requirement of functionalRequirements.filter(function (item) {
        return item.status === "approved";
    })) {
        const option = document.createElement("option");
        option.value = requirement.id;
        option.textContent = `${requirement.title} — approved v${requirement.currentVersion}`;
        technicalOriginInput.append(option);
    }

    if (Array.from(technicalOriginInput.options).some(function (option) {
        return option.value === selectedValue;
    })) {
        technicalOriginInput.value = selectedValue;
    }
}

async function loadTechnicalRequirements() {
    const result = await requestJson("/api/technical-requirements");
    technicalRequirements = result.items;
    renderTaskOriginOptions();

    if (selectedTechnicalRequirementId) {
        const selectedStillExists = result.items.some(function (requirement) {
            return requirement.id === selectedTechnicalRequirementId;
        });

        if (selectedStillExists) {
            await loadTechnicalRequirement(selectedTechnicalRequirementId);
        }
    }

    if (selectedRequirementId) {
        await loadDerivedTechnicalRequirements(selectedRequirementId);
    }

    renderDocumentTree();
}

async function loadRequirement(requirementId) {
    const requirement = await requestJson(`/api/functional-requirements/${requirementId}`);
    selectedRequirementId = requirement.id;
    setActiveDocument("functional", requirement.id);
    renderRequirement(requirement);
    technicalOriginInput.value = requirement.status === "approved" ? requirement.id : "";
    await loadDerivedTechnicalRequirements(requirement.id);
    renderDocumentTree();
}

async function loadRequirements() {
    const result = await requestJson("/api/functional-requirements");
    functionalRequirements = result.items;
    renderTechnicalOriginOptions();

    if (selectedRequirementId) {
        const selectedStillExists = result.items.some(function (requirement) {
            return requirement.id === selectedRequirementId;
        });

        if (selectedStillExists) {
            await loadRequirement(selectedRequirementId);
        }
    }

    renderDocumentTree();
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

async function performTechnicalRequirementAction(url, createPayload, confirmationMessage) {
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
        selectedTechnicalRequirementId = requirement.id;
        technicalMessage.textContent = "Technical requirement updated.";
        await loadTechnicalRequirements();
    } catch (error) {
        technicalMessage.textContent = error.message;
    }
}

async function performTaskAction(url, createPayload, confirmationMessage) {
    try {
        const payload = createPayload();

        if (confirmationMessage && !window.confirm(confirmationMessage)) {
            return;
        }

        const task = await requestJson(url, {
            body: JSON.stringify(payload),
            headers: {"content-type": "application/json"},
            method: "POST"
        });
        selectedTaskId = task.id;
        taskMessage.textContent = "Task updated.";
        await loadTasks();
    } catch (error) {
        taskMessage.textContent = error.message;
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

technicalForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
        const requirement = await requestJson("/api/technical-requirements", {
            body: JSON.stringify({
                actorName: getActorName(),
                functionalRequirementId: technicalOriginInput.value,
                statement: technicalStatementInput.value,
                title: technicalTitleInput.value
            }),
            headers: {"content-type": "application/json"},
            method: "POST"
        });

        rememberActorName();
        selectedTechnicalRequirementId = requirement.id;
        const originId = technicalOriginInput.value;
        technicalForm.reset();
        technicalOriginInput.value = originId;
        technicalMessage.textContent = "Technical draft created.";
        await loadTechnicalRequirements();
    } catch (error) {
        technicalMessage.textContent = error.message;
    }
});

reviseTechnicalRequirementButton.addEventListener("click", async function () {
    if (!selectedTechnicalRequirementId) {
        return;
    }

    await performTechnicalRequirementAction(`/api/technical-requirements/${selectedTechnicalRequirementId}/revisions`, function () {
        return {
            actorName: getActorName(),
            note: technicalRevisionNoteInput.value,
            statement: technicalRevisionStatementInput.value,
            title: technicalRevisionTitleInput.value
        };
    });
});

submitTechnicalRequirementButton.addEventListener("click", async function () {
    if (!selectedTechnicalRequirementId) {
        return;
    }

    await performTechnicalRequirementAction(`/api/technical-requirements/${selectedTechnicalRequirementId}/review`, function () {
        return {
            actorName: getActorName()
        };
    }, "Submit this technical draft for human review?");
});

approveTechnicalRequirementButton.addEventListener("click", async function () {
    if (!selectedTechnicalRequirementId) {
        return;
    }

    await performTechnicalRequirementAction(`/api/technical-requirements/${selectedTechnicalRequirementId}/decisions`, function () {
        return {
            actorName: getActorName(),
            decision: "approved",
            note: technicalRevisionNoteInput.value
        };
    }, "Approve this immutable technical requirement version?");
});

rejectTechnicalRequirementButton.addEventListener("click", async function () {
    if (!selectedTechnicalRequirementId) {
        return;
    }

    await performTechnicalRequirementAction(`/api/technical-requirements/${selectedTechnicalRequirementId}/decisions`, function () {
        return {
            actorName: getActorName(),
            decision: "rejected",
            note: technicalRevisionNoteInput.value
        };
    }, "Reject this technical requirement version?");
});

technicalOriginLink.addEventListener("click", async function () {
    if (!selectedTechnicalRequirement) {
        return;
    }

    try {
        activateTab("functional");
        await loadRequirement(selectedTechnicalRequirement.functionalRequirementId);
        requirementMessage.textContent = "";
        requirementDetail.scrollIntoView({behavior: "smooth", block: "start"});
    } catch (error) {
        requirementMessage.textContent = error.message;
    }
});

taskForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
        const task = await requestJson("/api/tasks", {
            body: JSON.stringify({
                acceptanceCriteria: parseAcceptanceCriteria(taskCriteriaInput.value),
                actorName: getActorName(),
                objective: taskObjectiveInput.value,
                technicalRequirementId: taskOriginInput.value,
                title: taskTitleInput.value
            }),
            headers: {"content-type": "application/json"},
            method: "POST"
        });

        rememberActorName();
        selectedTaskId = task.id;
        const originId = taskOriginInput.value;
        taskForm.reset();
        taskOriginInput.value = originId;
        taskMessage.textContent = "Task draft created.";
        await loadTasks();
    } catch (error) {
        taskMessage.textContent = error.message;
    }
});

reviseTaskButton.addEventListener("click", async function () {
    if (!selectedTaskId) {
        return;
    }

    await performTaskAction(`/api/tasks/${selectedTaskId}/revisions`, function () {
        return {
            acceptanceCriteria: parseAcceptanceCriteria(taskRevisionCriteriaInput.value),
            actorName: getActorName(),
            note: taskRevisionNoteInput.value,
            objective: taskRevisionObjectiveInput.value,
            title: taskRevisionTitleInput.value
        };
    });
});

submitTaskButton.addEventListener("click", async function () {
    if (!selectedTaskId) {
        return;
    }

    await performTaskAction(`/api/tasks/${selectedTaskId}/review`, function () {
        return {
            actorName: getActorName()
        };
    }, "Submit this task draft for human review?");
});

approveTaskButton.addEventListener("click", async function () {
    if (!selectedTaskId) {
        return;
    }

    await performTaskAction(`/api/tasks/${selectedTaskId}/decisions`, function () {
        return {
            actorName: getActorName(),
            decision: "approved",
            note: taskRevisionNoteInput.value
        };
    }, "Approve this immutable task version?");
});

rejectTaskButton.addEventListener("click", async function () {
    if (!selectedTaskId) {
        return;
    }

    await performTaskAction(`/api/tasks/${selectedTaskId}/decisions`, function () {
        return {
            actorName: getActorName(),
            decision: "rejected",
            note: taskRevisionNoteInput.value
        };
    }, "Reject this task version?");
});

runTaskReadinessCheckButton.addEventListener("click", async function () {
    if (!selectedTaskId) {
        return;
    }

    await performTaskAction(`/api/tasks/${selectedTaskId}/checks`, function () {
        return {};
    }, "Run the deterministic approved-chain readiness check?");
});

taskOriginLink.addEventListener("click", async function () {
    if (!selectedTask) {
        return;
    }

    try {
        activateTab("technical");
        await loadTechnicalRequirement(selectedTask.technicalRequirementId);
        technicalMessage.textContent = "";
        technicalDetail.scrollIntoView({behavior: "smooth", block: "start"});
    } catch (error) {
        technicalMessage.textContent = error.message;
    }
});

viewProcessButton.addEventListener("click", function () {
    if (selectedTaskTrace) {
        activateTab("process", true);
    }
});

traceFunctionalLink.addEventListener("click", async function () {
    if (!selectedTaskTrace) {
        return;
    }

    try {
        activateTab("functional");
        await loadRequirement(selectedTaskTrace.chain.functionalRequirement.id);
        requirementMessage.textContent = "";
        requirementDetail.scrollIntoView({behavior: "smooth", block: "start"});
    } catch (error) {
        requirementMessage.textContent = error.message;
    }
});

traceTechnicalLink.addEventListener("click", async function () {
    if (!selectedTaskTrace) {
        return;
    }

    try {
        activateTab("technical");
        await loadTechnicalRequirement(selectedTaskTrace.chain.technicalRequirement.id);
        technicalMessage.textContent = "";
        technicalDetail.scrollIntoView({behavior: "smooth", block: "start"});
    } catch (error) {
        technicalMessage.textContent = error.message;
    }
});

for (const tab of workspaceTabs) {
    tab.addEventListener("click", function () {
        activateTab(tab.dataset.tab);
    });
    tab.addEventListener("keydown", function (event) {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            moveTabFocus(tab, event.key);
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activateTab(tab.dataset.tab);
        }
    });
}

restoreActorName();
loadStatus();
loadRequirements().then(function () {
    return loadTechnicalRequirements();
}).then(function () {
    return loadTasks();
}).catch(function (error) {
    requirementMessage.textContent = error.message;
    technicalMessage.textContent = error.message;
    taskMessage.textContent = error.message;
});
