# Slop Stop

Minimal Node.js MVP for governing versioned functional and technical requirements with explicit human approval.

## Requirements

- Node.js 24
- npm
- Git
- Codex CLI, authenticated with `codex login`, only for optional AI review and smoke requests

## Quick start

```sh
npm ci
npm run setup:harness
npm test
npm start
```

Open `http://127.0.0.1:3000`.

## API contract

OpenAPI 3.0.3 is generated from the same route schemas used for request validation:

- Explorer: `http://127.0.0.1:3000/documentation/`
- JSON: `http://127.0.0.1:3000/documentation/json`
- YAML: `http://127.0.0.1:3000/documentation/yaml`

Every documented operation has a stable `operationId`. Every response includes an `X-Request-Id` UUID for local request tracing.

## Functional requirements

The web UI supports draft creation, immutable revisions, review submission, and an explicit human approval or rejection. Evidence is appended to `.data/events.jsonl`.

The M1 store is designed for one local application process. If a JSONL record is malformed, reads and writes stop with `STORE_CORRUPTED`; repair is deliberately manual.

## Technical requirements

An approved functional requirement can originate multiple technical requirements. Each technical requirement keeps exactly one immutable link to the originating functional requirement ID and approved version.

Technical requirements use the same versioned human-review lifecycle. The UI supports navigation from functional intent to its technical derivations and back to the exact approved origin.

## Task drafts

An approved technical requirement can originate multiple versioned task drafts. Each task contains a title, objective, and acceptance criteria while preserving the immutable technical requirement ID and approved version.

Each task exposes a read-only process trace with the exact functional and technical origins plus one normalized chronological timeline. Raw event payloads and Codex internals are not exposed.

Task readiness, execution, checks, results, and completion remain later milestones.

## Codex review proposals

For a draft requirement, the UI can send its current title, origin, and statement to Codex after explicit confirmation. Codex returns a structured proposal with a summary, missing information, ambiguities, and a suggested revision.

The proposal is recorded as AI evidence but cannot change state, revise content, or approve the requirement. A human may copy the suggestion into the revision fields and must then create the revision separately.

Codex runs through [non-interactive mode](https://developers.openai.com/codex/noninteractive) with an output schema, an ephemeral session, ignored local rules, and a read-only sandbox. Raw prompts, reasoning, and JSONL output are not persisted.

Run the fixed, isolated real review smoke test only when intended:

```sh
npm run smoke:codex-review
```

It uses a temporary event store and removes it after the call.

## Codex smoke test

Check Codex readiness in the web page, then explicitly confirm the read-only smoke test. The same check is available from the command line:

```sh
npm run smoke:codex
```

The real Codex smoke test is optional and is never run by the regular test suite or CI.

## Local governance harness

`npm run setup:harness` creates `SYSTEM.md`, `AGENTS.md`, and `docs/` without overwriting existing files. These working files are intentionally ignored by Git. Their reusable baseline lives in `harness/templates/`.

## Current limits

Identity is declared through a display name and is not authenticated. There is no task execution lifecycle, database, deployment configuration, multi-provider abstraction, automatic code modification, or AI approval authority.
