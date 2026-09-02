# Slop Stop

Minimal Node.js scaffold for a governed AI application using the Luminous architecture.

## Requirements

- Node.js 24
- npm
- Git
- Codex CLI, authenticated with `codex login`

## Quick start

```sh
npm ci
npm run setup:harness
npm test
npm start
```

Open `http://127.0.0.1:3000`.

## Codex smoke test

Check Codex readiness in the web page, then explicitly confirm the read-only smoke test. The same check is available from the command line:

```sh
npm run smoke:codex
```

The real Codex smoke test is optional and is never run by the regular test suite or CI.

## Local governance harness

`npm run setup:harness` creates `SYSTEM.md`, `AGENTS.md`, and `docs/` without overwriting existing files. These working files are intentionally ignored by Git. Their reusable baseline lives in `harness/templates/`.

## M0 limits

This increment provides the runtime shell, Luminous boundaries, deterministic tests, and Codex connectivity only. It does not include the product workflow, persistence, authentication, deployment, or automatic code modification.

