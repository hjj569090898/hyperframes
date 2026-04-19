import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { enqueueLocalTask, resolveLocalQueuePaths } from "./localQueue.js";
import type { WorkerQueueAdapter } from "./queue.js";
import { runWorkerLoop, runWorkerOnce } from "./runner.js";

test("runWorkerOnce returns idle when no queued task exists", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-runner-idle-"));
  try {
    const result = await runWorkerOnce({ queueRoot });

    assert.equal(result.status, "idle");
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
  }
});

test("runWorkerOnce claims, materializes, and completes one queued task", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-runner-"));
  const outputRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-output-"));
  try {
    const paths = resolveLocalQueuePaths(queueRoot);
    await enqueueLocalTask(
      {
        id: "task_runner_001",
        kind: "generate_video",
        payload: {
          projectId: "project_runner",
          versionId: "version_runner",
          sourceUrl: "https://example.com",
          templateId: "product-demo",
        },
      },
      { queueRoot },
    );

    const result = await runWorkerOnce({
      queueRoot,
      outputRoot,
      workerId: "worker_runner_test",
      now: () => new Date("2026-04-19T03:04:05.000Z"),
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.taskId, "task_runner_001");
    assert.deepEqual(await readdir(paths.queuedDir), []);
    assert.deepEqual(await readdir(paths.runningDir), []);
    assert.deepEqual((await readdir(paths.succeededDir)).sort(), [
      "task_runner_001.json",
      "task_runner_001.result.json",
    ]);

    assert.ok(result.resultPath);
    const taskResult = JSON.parse(await readFile(result.resultPath, "utf8"));
    assert.equal(taskResult.taskId, "task_runner_001");
    assert.match(taskResult.workspaceDir, /task_runner_001$/);

    const manifest = JSON.parse(await readFile(taskResult.manifestPath, "utf8"));
    assert.equal(manifest.projectId, "project_runner");
    assert.equal(manifest.generatedAt, "2026-04-19T03:04:05.000Z");
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("runWorkerLoop processes queued tasks until the queue is idle", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-loop-"));
  const outputRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-loop-output-"));
  try {
    const paths = resolveLocalQueuePaths(queueRoot);
    await enqueueLocalTask(
      {
        id: "task_loop_001",
        kind: "generate_video",
        payload: {
          projectId: "project_loop_1",
          versionId: "version_loop_1",
        },
      },
      { queueRoot },
    );
    await enqueueLocalTask(
      {
        id: "task_loop_002",
        kind: "generate_video",
        payload: {
          projectId: "project_loop_2",
          versionId: "version_loop_2",
        },
      },
      { queueRoot },
    );

    const result = await runWorkerLoop({
      queueRoot,
      outputRoot,
      maxIterations: 5,
      pollMs: 0,
    });

    assert.equal(result.status, "stopped");
    assert.equal(result.processed, 2);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 0);
    assert.equal(result.idleCount, 1);
    assert.deepEqual(await readdir(paths.queuedDir), []);
    assert.deepEqual((await readdir(paths.succeededDir)).sort(), [
      "task_loop_001.json",
      "task_loop_001.result.json",
      "task_loop_002.json",
      "task_loop_002.result.json",
    ]);
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("runWorkerOnce can execute against an injected queue adapter", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-adapter-output-"));
  try {
    const events: string[] = [];
    const adapter: WorkerQueueAdapter = {
      name: "fake",
      async claimNext() {
        events.push("claim");
        return {
          workerId: "worker_adapter_test",
          claim: { source: "fake" },
          task: {
            id: "task_adapter_001",
            kind: "generate_video",
            status: "claimed",
            payload: {
              projectId: "project_adapter",
              versionId: "version_adapter",
            },
          },
        };
      },
      async markRunning(claim) {
        events.push(`running:${claim.task.id}`);
      },
      async complete(claim, result) {
        events.push(`complete:${claim.task.id}`);
        return {
          resultPath: join(result.workspaceDir, "fake.result.json"),
        };
      },
      async fail() {
        assert.fail("fail should not be called");
      },
    };

    const result = await runWorkerOnce({
      queueAdapter: adapter,
      outputRoot,
      now: () => new Date("2026-04-19T06:07:08.000Z"),
    });

    assert.equal(result.status, "succeeded");
    assert.equal(result.taskId, "task_adapter_001");
    assert.equal(result.resultPath, join(result.workspaceDir, "fake.result.json"));
    assert.deepEqual(events, ["claim", "running:task_adapter_001", "complete:task_adapter_001"]);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
