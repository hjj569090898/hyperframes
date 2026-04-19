import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  claimNextLocalTask,
  completeLocalTask,
  enqueueLocalTask,
  failLocalTask,
  resolveLocalQueuePaths,
} from "./localQueue.js";

const rawGenerateTask = {
  id: "task/queue:001",
  kind: "generate_video",
  payload: {
    projectId: "project_queue",
    versionId: "version_queue",
    sourceUrl: "https://example.com",
    templateId: "product-demo",
  },
};

test("enqueues a task into the queued directory and prepares status directories", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-queue-"));
  try {
    const result = await enqueueLocalTask(rawGenerateTask, { queueRoot });
    const paths = resolveLocalQueuePaths(queueRoot);

    assert.equal(result.task.id, "task/queue:001");
    assert.equal(result.task.status, "queued");
    assert.equal(result.taskPath, join(paths.queuedDir, "task_queue_001.json"));

    const queuedTask = JSON.parse(await readFile(result.taskPath, "utf8"));
    assert.equal(queuedTask.payload.projectId, "project_queue");

    assert.deepEqual((await readdir(paths.runningDir)).sort(), []);
    assert.deepEqual((await readdir(paths.succeededDir)).sort(), []);
    assert.deepEqual((await readdir(paths.failedDir)).sort(), []);
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
  }
});

test("claims the next queued task by moving it into running", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-claim-"));
  try {
    const paths = resolveLocalQueuePaths(queueRoot);
    await enqueueLocalTask(
      {
        ...rawGenerateTask,
        id: "task_b",
        payload: { ...rawGenerateTask.payload, projectId: "project_b" },
      },
      { queueRoot },
    );
    await enqueueLocalTask(
      {
        ...rawGenerateTask,
        id: "task_a",
        payload: { ...rawGenerateTask.payload, projectId: "project_a" },
      },
      { queueRoot },
    );

    const claim = await claimNextLocalTask({ queueRoot, workerId: "worker_test" });

    assert.ok(claim);
    assert.equal(claim.task.id, "task_a");
    assert.equal(claim.task.status, "running");
    assert.equal(claim.workerId, "worker_test");
    assert.equal(claim.taskPath, join(paths.runningDir, "task_a.json"));
    assert.deepEqual((await readdir(paths.queuedDir)).sort(), ["task_b.json"]);
    assert.deepEqual((await readdir(paths.runningDir)).sort(), ["task_a.json"]);
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
  }
});

test("completes a running task by moving it into succeeded with a result file", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-complete-"));
  try {
    const paths = resolveLocalQueuePaths(queueRoot);
    await enqueueLocalTask(rawGenerateTask, { queueRoot });
    const claim = await claimNextLocalTask({ queueRoot });
    assert.ok(claim);

    const result = await completeLocalTask(claim, {
      workspaceDir: "workspace",
      manifestPath: "workspace/manifest.json",
    });

    assert.equal(result.taskPath, join(paths.succeededDir, "task_queue_001.json"));
    assert.equal(result.resultPath, join(paths.succeededDir, "task_queue_001.result.json"));
    assert.deepEqual(await readdir(paths.runningDir), []);

    const completedTask = JSON.parse(await readFile(result.taskPath, "utf8"));
    assert.equal(completedTask.status, "succeeded");

    const taskResult = JSON.parse(await readFile(result.resultPath, "utf8"));
    assert.equal(taskResult.workspaceDir, "workspace");
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
  }
});

test("fails a running task by moving it into failed with an error file", async () => {
  const queueRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-fail-"));
  try {
    const paths = resolveLocalQueuePaths(queueRoot);
    await enqueueLocalTask(rawGenerateTask, { queueRoot });
    const claim = await claimNextLocalTask({ queueRoot });
    assert.ok(claim);

    const result = await failLocalTask(claim, new Error("render exploded"));

    assert.equal(result.taskPath, join(paths.failedDir, "task_queue_001.json"));
    assert.equal(result.errorPath, join(paths.failedDir, "task_queue_001.error.json"));
    assert.deepEqual(await readdir(paths.runningDir), []);

    const failedTask = JSON.parse(await readFile(result.taskPath, "utf8"));
    assert.equal(failedTask.status, "failed");

    const errorJson = JSON.parse(await readFile(result.errorPath, "utf8"));
    assert.equal(errorJson.message, "render exploded");
  } finally {
    await rm(queueRoot, { recursive: true, force: true });
  }
});
