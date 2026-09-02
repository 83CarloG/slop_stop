"use strict";

const fs = require("fs");
const path = require("path");
const process = require("process");

const templateMappings = [
    ["system.template.md", "SYSTEM.md"],
    ["agents.template.md", "AGENTS.md"],
    ["docs/product/product.template.md", "docs/product/PRODUCT.md"],
    ["docs/architecture/architecture.template.md", "docs/architecture/ARCHITECTURE.md"],
    ["docs/governance/workflow.template.md", "docs/governance/WORKFLOW.md"],
    ["docs/decisions/adr0001.template.md", "docs/decisions/ADR-0001-luminous-architecture.md"],
    ["docs/milestones/m0.template.md", "docs/milestones/M0.md"],
    ["docs/tasks/t001.template.md", "docs/tasks/T-001-project-scaffold.md"],
    ["docs/evidence/e001.template.md", "docs/evidence/E-001-project-scaffold.md"],
    ["docs/templates/adr.template.md", "docs/templates/ADR.template.md"],
    ["docs/templates/task.template.md", "docs/templates/TASK.template.md"],
    ["docs/templates/evidence.template.md", "docs/templates/EVIDENCE.template.md"]
];

function resolveInside(rootDirectory, relativePath) {
    const absoluteRoot = path.resolve(rootDirectory);
    const absoluteTarget = path.resolve(absoluteRoot, relativePath);
    const relativeTarget = path.relative(absoluteRoot, absoluteTarget);

    if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        throw new Error(`Path escapes the target root: ${relativePath}`);
    }

    return absoluteTarget;
}

function setupHarness(targetRoot = process.cwd()) {
    const projectRoot = process.cwd();
    const templateRoot = path.resolve(projectRoot, "harness", "templates");
    const result = {
        created: [],
        skipped: []
    };

    for (const [templatePath, targetPath] of templateMappings) {
        const source = resolveInside(templateRoot, templatePath);
        const target = resolveInside(targetRoot, targetPath);

        fs.mkdirSync(path.dirname(target), {recursive: true});

        try {
            fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
            result.created.push(targetPath);
        } catch (error) {
            if (error.code !== "EEXIST") {
                throw error;
            }

            result.skipped.push(targetPath);
        }
    }

    return result;
}

module.exports = setupHarness;

if (require.main === module) {
    const result = setupHarness();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

