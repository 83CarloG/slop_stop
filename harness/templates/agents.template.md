# Agent Instructions

Read `SYSTEM.md` before changing the project.

## Working rules

- Use English for documentation, code, variables, file names, and user-facing strings.
- Work incrementally and keep each change focused on one approved task.
- Ask for human approval before external side effects or workspace-writing AI execution.
- Do not store credentials, raw prompts containing private data, or chain-of-thought.
- Record decisions and evidence without creating a daily activity log.

## Luminous rules

- External entrypoints call services only.
- Services may call features, operations, jobs, and drivers.
- Features may call operations, jobs, and drivers.
- Operations may call jobs only.
- Jobs may call drivers only.
- Drivers may not call another internal layer.
- Same-layer calls are forbidden.
- Fastify and HTTP objects must stay outside `src/`.
- Add a layer implementation only when it provides real behavior.

