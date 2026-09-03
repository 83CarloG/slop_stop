"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const process = require("process");
const test = require("node:test");

const html = fs.readFileSync(path.resolve(process.cwd(), "public", "index.html"), "utf8");
const client = fs.readFileSync(path.resolve(process.cwd(), "public", "app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "public", "styles.css"), "utf8");

test("the workspace exposes four matching accessible tabs and panels", function () {
    const tabs = ["functional", "technical", "tasks", "process"];

    assert.match(html, /id="workspace-tabs"[^>]+role="tablist"/u);

    for (const tab of tabs) {
        assert.match(
            html,
            new RegExp(`id="tab-${tab}"[^>]+role="tab"[^>]+aria-controls="panel-${tab}"`, "u")
        );
        assert.match(
            html,
            new RegExp(`id="panel-${tab}"[^>]+role="tabpanel"[^>]+aria-labelledby="tab-${tab}"`, "u")
        );
    }

    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Enter"]) {
        assert.equal(client.includes(`"${key}"`), true);
    }

    assert.equal(client.includes("event.key === \" \""), true);
});

test("the hierarchy is shared and the process panel remains read-only", function () {
    const processStart = html.indexOf("id=\"panel-process\"");
    const processEnd = html.indexOf("</section>", processStart);
    const processPanel = html.slice(processStart, processEnd);

    assert.ok(html.indexOf("id=\"document-tree\"") < html.indexOf("id=\"workspace-tabs\""));
    assert.match(html, /id="document-tree"[^>]+aria-label="Document hierarchy"/u);
    assert.equal(processPanel.includes("<form"), false);
    assert.equal(processPanel.includes("<input"), false);
    assert.equal(processPanel.includes("<textarea"), false);
    assert.match(html, /id="submit-task"/u);
    assert.match(html, /id="approve-task"/u);
    assert.match(html, /id="reject-task"/u);
    assert.equal(client.includes("functionalRequirementId === functionalRequirement.id"), true);
    assert.equal(client.includes("task.technicalRequirementId === technicalRequirement.id"), true);
});

test("the document contains unique identifiers and responsive focus styles", function () {
    const identifiers = Array.from(html.matchAll(/\sid="([^"]+)"/gu), function (match) {
        return match[1];
    });

    assert.equal(new Set(identifiers).size, identifiers.length);
    assert.match(styles, /:focus-visible/u);
    assert.match(styles, /@media \(max-width: 47rem\)/u);
    assert.match(styles, /\.workspace-shell\s*\{/u);
    assert.match(styles, /\.document-sidebar\s*\{/u);
});
