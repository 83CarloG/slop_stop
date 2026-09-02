# Slop Stop

Minimal Node.js MVP for governing versioned functional requirements with explicit human approval.

## Requirements

- Node.js 24
- npm
- Git
- Codex CLI, authenticated with `codex login`, only for the optional smoke test

## Quick start

```sh
npm ci
npm run setup:harness
npm test
npm start
```

Open `http://127.0.0.1:3000`.

## Functional requirements

The web UI supports draft creation, immutable revisions, review submission, and an explicit human approval or rejection. Evidence is appended to `.data/events.jsonl`.

The M1 store is designed for one local application process. If a JSONL record is malformed, reads and writes stop with `STORE_CORRUPTED`; repair is deliberately manual.

## Codex smoke test

Check Codex readiness in the web page, then explicitly confirm the read-only smoke test. The same check is available from the command line:

```sh
npm run smoke:codex
```

The real Codex smoke test is optional and is never run by the regular test suite or CI.

## Local governance harness

`npm run setup:harness` creates `SYSTEM.md`, `AGENTS.md`, and `docs/` without overwriting existing files. These working files are intentionally ignored by Git. Their reusable baseline lives in `harness/templates/`.

## Current limits

Identity is declared through a display name and is not authenticated. There is no database, deployment configuration, multi-provider abstraction, or automatic code modification. Codex can only run the isolated connectivity smoke test; functional requirement review by Codex is reserved for the next human-approved increment.
