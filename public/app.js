"use strict";

const applicationStatus = document.querySelector("#application-status");
const codexStatus = document.querySelector("#codex-status");
const codexSmokeButton = document.querySelector("#codex-smoke");
const codexResult = document.querySelector("#codex-result");

async function readJson(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "The request failed.");
    }

    return data;
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
            codexStatus.textContent = `Ready: ${status.version || "version unavailable"}`;
            codexSmokeButton.disabled = false;
        } else if (status.available) {
            codexStatus.textContent = "Codex CLI is available but not authenticated.";
        } else {
            codexStatus.textContent = "Codex CLI is not available.";
        }
    } catch (error) {
        codexStatus.textContent = "Codex status could not be checked.";
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

loadStatus();

