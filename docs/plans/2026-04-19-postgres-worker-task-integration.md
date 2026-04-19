# Postgres Worker Task Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let `@hyperframes/saasreels-worker` consume real `worker_task` rows from the shared Postgres database while keeping the current dry-run execution path and local queue fallback.

**Architecture:** Add a queue adapter layer so `runner.ts` can work with either the existing local file queue or a new Postgres-backed queue adapter. The Postgres adapter mirrors the `saasreels-web` `worker_task` lifecycle and uses `pg` directly.

**Tech Stack:** Bun workspaces, TypeScript, Node test runner, `pg`, existing `@hyperframes/saasreels-worker` dry-run materializer.

---

### Task 1: Add design scaffolding for queue backends

**Files:**
- Create: `packages/saasreels-worker/src/queue.ts`
- Modify: `packages/saasreels-worker/src/index.ts`
- Test: `packages/saasreels-worker/src/runner.test.ts`

**Step 1: Write the failing test**

Add a runner test that proves a queue backend can mark a claimed task as running, then complete it with the dry-run workspace result.

**Step 2: Run test to verify it fails**

Run: `bun run --filter @hyperframes/saasreels-worker test -- runner.test.ts`

Expected: FAIL because no queue adapter abstraction exists yet.

**Step 3: Write minimal implementation**

Define queue backend interfaces and export them through `src/index.ts`.

**Step 4: Run test to verify it passes**

Run: `bun run --filter @hyperframes/saasreels-worker test -- runner.test.ts`

Expected: PASS.

### Task 2: Add Postgres queue adapter

**Files:**
- Create: `packages/saasreels-worker/src/postgresQueue.ts`
- Test: `packages/saasreels-worker/src/postgresQueue.test.ts`
- Modify: `packages/saasreels-worker/package.json`

**Step 1: Write the failing test**

Cover:
- missing database URL throws a clear error
- claim picks a queued task and increments attempts
- mark running updates only claimed tasks owned by the worker
- fail requeues before max attempts and marks failed after exhaustion

**Step 2: Run test to verify it fails**

Run: `bun run --filter @hyperframes/saasreels-worker test -- postgresQueue.test.ts`

Expected: FAIL because `postgresQueue.ts` does not exist.

**Step 3: Write minimal implementation**

Use a small `pg` client abstraction so tests can inject a fake query client.

**Step 4: Run test to verify it passes**

Run: `bun run --filter @hyperframes/saasreels-worker test -- postgresQueue.test.ts`

Expected: PASS.

### Task 3: Teach the runner to use local or Postgres queue backends

**Files:**
- Modify: `packages/saasreels-worker/src/runner.ts`
- Modify: `packages/saasreels-worker/src/runner.test.ts`
- Modify: `packages/saasreels-worker/src/index.ts`

**Step 1: Write the failing test**

Add a `postgres` runner test that injects a fake queue client and expects:

- `runWorkerOnce` to claim a task
- mark it `running`
- materialize the dry-run workspace
- mark it `succeeded`

**Step 2: Run test to verify it fails**

Run: `bun run --filter @hyperframes/saasreels-worker test -- runner.test.ts`

Expected: FAIL because runner only understands the local queue.

**Step 3: Write minimal implementation**

Add:

- `queueBackend?: "local" | "postgres"`
- `databaseUrl?: string`
- `leaseDurationMs?: number`
- optional injected Postgres query client for tests

Keep local queue behavior unchanged by default.

**Step 4: Run test to verify it passes**

Run: `bun run --filter @hyperframes/saasreels-worker test -- runner.test.ts`

Expected: PASS.

### Task 4: Extend CLI for Postgres-backed execution

**Files:**
- Modify: `packages/saasreels-worker/src/cli.ts`
- Modify: `packages/saasreels-worker/src/cli.test.ts`
- Modify: `packages/saasreels-worker/README.md`

**Step 1: Write the failing test**

Cover:

- `--queue-backend postgres`
- `--database-url`
- `--lease-ms`

for `run-once` and `run-loop`.

**Step 2: Run test to verify it fails**

Run: `bun run --filter @hyperframes/saasreels-worker test -- cli.test.ts`

Expected: FAIL because the new flags are unknown.

**Step 3: Write minimal implementation**

Parse and forward the new flags. Keep `enqueue` local-only for this phase.

**Step 4: Run test to verify it passes**

Run: `bun run --filter @hyperframes/saasreels-worker test -- cli.test.ts`

Expected: PASS.

### Task 5: Verify the full worker package

**Files:**
- No additional source files.

**Step 1: Run the package test suite**

Run: `bun run --filter @hyperframes/saasreels-worker test`

Expected: PASS.

**Step 2: Run typecheck**

Run: `bun run --filter @hyperframes/saasreels-worker typecheck`

Expected: PASS.

**Step 3: Run lint**

Run: `bunx oxlint packages/saasreels-worker`

Expected: PASS.

**Step 4: Run format check**

Run: `bunx oxfmt --check packages/saasreels-worker`

Expected: PASS.
