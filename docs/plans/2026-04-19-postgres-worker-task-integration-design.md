# Postgres Worker Task Integration Design

Date: 2026-04-19
Owner: HyperFrames worker side

## Goal

Connect `@hyperframes/saasreels-worker` to the `saasreels-web` `worker_task` Postgres queue so the worker can:

- claim queued tasks from the shared database
- mark tasks `running`
- execute the existing dry-run workspace materialization
- mark tasks `succeeded` or `failed`

This phase does not add real rendering, R2 upload, or pipeline artifact writes.

## Product Boundary

`saasreels-web` remains the source of truth for:

- `worker_task` creation
- task payload schema
- user/project/version records
- pipeline UI and polling

`HyperFrames` owns:

- worker process lifecycle
- queue consumption
- dry-run execution
- final task status/result writeback

## Design Choice

### Recommended

Add a second queue backend to the existing worker package:

- `local` keeps the current file-based development flow
- `postgres` consumes the shared `worker_task` table

This keeps the runner and CLI stable while making queue storage swappable.

### Why this option

- low risk because the current local queue keeps working
- aligns with the web team's new Postgres queue immediately
- lets us prove end-to-end background execution before adding real render logic

### Not chosen

Replace the current local queue completely.

That would make local debugging harder and increase the blast radius of this change.

## Architecture

### 1. Queue adapter layer

Introduce a small worker queue interface used by `runner.ts`.

Each backend implements the same lifecycle:

1. claim next task
2. mark running
3. complete with result
4. fail with retry-aware status handling

### 2. Postgres adapter

Add a `postgresQueue.ts` module that mirrors the `saasreels-web` queue semantics:

- claim `queued` tasks or expired `claimed` tasks
- order by `priority DESC, created_at ASC`
- increment `attempts` on claim
- move `claimed -> running`
- on failure, requeue until `attempts >= max_attempts`

The adapter uses `pg` directly instead of importing web-side code, because the worker runs in a separate repository.

### 3. Runner behavior

`runWorkerOnce` and `runWorkerLoop` gain a queue backend switch:

- default: `local`
- optional: `postgres`

For `postgres`, the worker still runs the existing `materializeDryRunWorkspace()` path so the execution step stays deterministic and small.

### 4. CLI behavior

Add flags for worker execution commands:

- `--queue-backend local|postgres`
- `--database-url <url>` optional, falls back to `process.env.DATABASE_URL`
- `--lease-ms <number>` optional

`enqueue` stays local-only in this phase because the web app already owns database task creation.

## Result Shape

Successful Postgres tasks will write a JSON `result` payload containing the dry-run output:

- `taskId`
- `workspaceDir`
- `manifestPath`
- `taskPath`
- `mode: "dry-run"`

This is enough for queue integration testing even though the paths are local to the worker machine.

## Error Handling

- Missing `DATABASE_URL` with `postgres` backend throws a clear configuration error.
- Unknown task kinds still fail during normalization.
- Failure handling mirrors web semantics:
  - retry by moving back to `queued`
  - final exhaustion moves task to `failed`

## Testing

Use TDD and keep tests isolated from a live database:

- queue adapter tests with a fake `pg` client
- runner tests for `postgres` backend using injected fake client
- CLI parsing tests for new flags

## Out of Scope

- real HyperFrames render execution
- R2 upload
- `pipeline_run`, `pipeline_event`, `pipeline_artifact` writes
- lease renewal heartbeat
- task cancellation handling
