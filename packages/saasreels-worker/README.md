# @hyperframes/saasreels-worker

SaaSReels-specific worker adapter for HyperFrames.

This package is intentionally small. It lets the worker team develop the execution side before the web team finishes the production database queue.

## Local Queue Mode

Local queue mode stores tasks as JSON files under:

```text
.tmp/saasreels-worker/tasks/
  queued/
  running/
  succeeded/
  failed/
```

This mirrors the production lifecycle:

```text
queued -> running -> succeeded
queued -> running -> failed
```

## Enqueue A Task

```bash
bun run --filter @hyperframes/saasreels-worker dev -- enqueue \
  --task-file ./task.json
```

Or inline:

```bash
bun run --filter @hyperframes/saasreels-worker dev -- enqueue \
  --task-json '{"id":"task_001","kind":"generate_video","payload":{"projectId":"project_001","versionId":"version_001"}}'
```

On Windows PowerShell, prefer `--task-file` because nested JSON quotes are easy to mangle through shell argument parsing.

## Run One Task

```bash
bun run --filter @hyperframes/saasreels-worker dev -- run-once
```

## Run Until Idle

```bash
bun run --filter @hyperframes/saasreels-worker dev -- run-loop
```

Useful options:

- `--queue-dir <path>` overrides the local queue root.
- `--output-dir <path>` overrides dry-run workspace output.
- `--worker-id <id>` tags the local worker claim.
- `--max-iterations <number>` limits loop iterations.
- `--poll-ms <number>` controls delay between loop iterations.

## Current Scope

The runner currently performs a dry-run materialization only. It writes:

- `task.json`
- `manifest.json`
- queue result/error sidecars

Next phases will replace the dry-run processor with:

- database/R2 materialization
- `RenderSpec` to HyperFrames composition translation
- `@hyperframes/producer` rendering
- R2 upload and database progress updates
