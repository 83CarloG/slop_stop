# System Index

## Purpose

This file indexes the local governance context for Slop Stop.

## Canonical local documents

- Product: `docs/product/PRODUCT.md`
- Glossary: `docs/product/GLOSSARY.md`
- MVP roadmap: `docs/product/MVP_ROADMAP.md`
- Source map: `docs/product/SOURCE_MAP.md`
- Product traceability: `docs/product/TRACEABILITY.md`
- Architecture: `docs/architecture/ARCHITECTURE.md`
- Workflow: `docs/governance/WORKFLOW.md`
- Decisions: `docs/decisions/`
- Milestones: `docs/milestones/`
- Tasks: `docs/tasks/`
- Evidence: `docs/evidence/`

## Safety constraints

- Human approval is required before external, destructive, or workspace-writing actions.
- Never store credentials, raw reasoning, or chain-of-thought.
- AI output is a proposal until a human explicitly approves it.
- Keep changes small, reviewable, and independently verifiable.

## Repository policy

This file and `docs/` are local working context. They are not Git-tracked sources of truth. Versioned templates and executable architecture tests provide the reproducible baseline.
