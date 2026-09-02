# Architecture

## Source

The project follows the strict rules in `haiaty/luminous_architecture` at commit `693b65dcd12d5893cc5d488011e6f550c788886d`. The accompanying article provides secondary context.

## Dependency direction

```text
server     -> services
services   -> features | operations | jobs | drivers
features   -> operations | jobs | drivers
operations -> jobs
jobs       -> drivers
drivers    -> external systems only
```

Same-layer calls are forbidden. Cross-module exceptions are not enabled in M0.

## Boundaries

- `server/` owns Fastify, HTTP validation, and HTTP response mapping.
- `src/` contains only Luminous application logic.
- Services are the only application functions exposed to entrypoints.
- Each route invokes exactly one service with plain input and receives plain output.
- Drivers isolate external systems such as Codex CLI.
- No shared mutable global state is allowed.

## Code conventions

- CommonJS and one exported function per layer file
- camelCase file names
- exact `"use strict";` header
- LF line endings
- static internal imports rooted at `process.cwd()`

