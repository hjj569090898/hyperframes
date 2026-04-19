# SaaSReels HyperFrames Worker MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first SaaSReels-specific worker layer inside HyperFrames so it can accept web-owned task payloads and materialize a local render workspace without changing HyperFrames core rendering internals.

**Architecture:** Keep `saasreels-web` as the product and database owner. Add a private HyperFrames workspace package, `@hyperframes/saasreels-worker`, that validates SaaSReels task records, creates deterministic local worker directories, and later calls `@hyperframes/producer` for real rendering.

**Tech Stack:** Bun workspaces, TypeScript, Node built-in test runner with `tsx`, HyperFrames producer.

---

### Task 1: Lock Repository Baseline

**Files:**
- No source changes.

**Step 1: Back up dirty local changes**

Run: `git diff --binary --output=<backup>/tracked-changes.patch`

Expected: Backup contains tracked patch, untracked file list, and demo render outputs.

**Step 2: Stash local dirty state**

Run: `git stash push -u -m "codex: pre-v0.4.6 local hyperframes changes"`

Expected: `git status --short --branch` is clean.

**Step 3: Update main**

Run: `git pull --ff-only origin main`

Expected: `HEAD` points at `v0.4.6`.

### Task 2: Add Worker Package Test Contract

**Files:**
- Create: `packages/saasreels-worker/package.json`
- Create: `packages/saasreels-worker/tsconfig.json`
- Test: `packages/saasreels-worker/src/worker.test.ts`

**Step 1: Write failing tests**

Cover:
- `normalizeWorkerTask` accepts a `generate_video` task compatible with `saasreels-web` contracts.
- `normalizeWorkerTask` rejects unsupported task kinds.
- `materializeDryRunWorkspace` writes a local dry-run manifest and task snapshot.

**Step 2: Run test to verify it fails**

Run: `bun run --filter @hyperframes/saasreels-worker test`

Expected: FAIL because `src/worker.ts` does not exist yet.

### Task 3: Implement Minimal Dry-Run Worker

**Files:**
- Create: `packages/saasreels-worker/src/worker.ts`
- Create: `packages/saasreels-worker/src/index.ts`

**Step 1: Implement task normalization**

Support:
- `generate_video`
- `export_video`

Reject:
- missing task id
- unsupported task kind
- missing payload object
- missing required payload identifiers

**Step 2: Implement dry-run workspace materialization**

Write:
- `task.json`
- `manifest.json`

Default output root:

```text
.tmp/saasreels-worker
```

**Step 3: Run worker tests**

Run: `bun run --filter @hyperframes/saasreels-worker test`

Expected: PASS.

### Task 4: Add CLI Entry Point

**Files:**
- Create: `packages/saasreels-worker/src/cli.ts`
- Test: `packages/saasreels-worker/src/cli.test.ts`
- Modify: `packages/saasreels-worker/package.json`

**Step 1: Write failing CLI tests**

Cover:
- parses `--task-file`
- parses `--output-dir`
- reads JSON task file and materializes dry-run workspace

**Step 2: Implement CLI**

Support:
- `saasreels-worker --task-file <path>`
- `saasreels-worker --task-json <json>`
- `saasreels-worker --output-dir <path>`

**Step 3: Run tests**

Run: `bun run --filter @hyperframes/saasreels-worker test`

Expected: PASS.

### Task 5: Verify Workspace Integration

**Files:**
- No additional files.

**Step 1: Run focused tests**

Run: `bun run --filter @hyperframes/saasreels-worker test`

Expected: PASS.

**Step 2: Run typecheck**

Run: `bun run --filter @hyperframes/saasreels-worker typecheck`

Expected: PASS.

**Step 3: Check formatting/lint for new package**

Run: `bunx oxlint packages/saasreels-worker`

Expected: PASS.
