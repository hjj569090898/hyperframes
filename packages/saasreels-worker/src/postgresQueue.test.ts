import assert from "node:assert/strict";
import test from "node:test";

import { createPostgresQueueAdapter } from "./postgresQueue.js";
import type { DryRunWorkspaceResult } from "./worker.js";

type WorkerTaskRow = {
  id: string;
  kind: "generate_video" | "export_video";
  status: "queued" | "claimed" | "running" | "succeeded" | "failed" | "cancelled";
  payload: string;
  result: string | null;
  priority: number;
  claimed_by: string | null;
  claimed_at: Date | null;
  lease_until: Date | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};

class FakePgClient {
  constructor(private readonly tasks: WorkerTaskRow[]) {}

  async query(sql: string, values: unknown[] = []): Promise<{ rows: WorkerTaskRow[] }> {
    if (sql.includes("ORDER BY priority DESC, created_at ASC")) {
      const now = values[0] as Date;
      const available = this.tasks
        .filter(
          (task) =>
            task.status === "queued" ||
            (task.status === "claimed" && task.lease_until !== null && task.lease_until < now),
        )
        .sort((left, right) => {
          if (left.priority !== right.priority) {
            return right.priority - left.priority;
          }
          return left.created_at.getTime() - right.created_at.getTime();
        })[0];
      return { rows: available ? [cloneTask(available)] : [] };
    }

    if (sql.includes("status = 'claimed'") && sql.includes("attempts = attempts + 1")) {
      const workerId = values[0] as string;
      const now = values[1] as Date;
      const leaseUntil = values[2] as Date;
      const taskId = values[3] as string;
      const task = this.tasks.find((candidate) => candidate.id === taskId);
      if (
        !task ||
        !(
          task.status === "queued" ||
          (task.status === "claimed" && task.lease_until !== null && task.lease_until < now)
        )
      ) {
        return { rows: [] };
      }

      task.status = "claimed";
      task.claimed_by = workerId;
      task.claimed_at = now;
      task.lease_until = leaseUntil;
      task.attempts += 1;
      task.updated_at = now;
      return { rows: [cloneTask(task)] };
    }

    if (sql.includes("status = 'running'")) {
      const now = values[0] as Date;
      const taskId = values[1] as string;
      const workerId = values[2] as string;
      const task = this.tasks.find((candidate) => candidate.id === taskId);
      if (!task || task.claimed_by !== workerId || task.status !== "claimed") {
        return { rows: [] };
      }

      task.status = "running";
      task.started_at = now;
      task.updated_at = now;
      return { rows: [cloneTask(task)] };
    }

    if (sql.includes("status = 'succeeded'")) {
      const result = values[0] as string;
      const now = values[1] as Date;
      const taskId = values[2] as string;
      const task = this.tasks.find((candidate) => candidate.id === taskId);
      if (!task) {
        return { rows: [] };
      }

      task.status = "succeeded";
      task.result = result;
      task.finished_at = now;
      task.updated_at = now;
      return { rows: [cloneTask(task)] };
    }

    if (sql.includes("SELECT * FROM worker_task WHERE id = $1")) {
      const taskId = values[0] as string;
      const task = this.tasks.find((candidate) => candidate.id === taskId);
      return { rows: task ? [cloneTask(task)] : [] };
    }

    if (sql.includes("last_error = $2")) {
      const status = values[0] as WorkerTaskRow["status"];
      const lastError = values[1] as string;
      const finishedAt = values[2] as Date | null;
      const now = values[3] as Date;
      const taskId = values[4] as string;
      const task = this.tasks.find((candidate) => candidate.id === taskId);
      if (!task) {
        return { rows: [] };
      }

      task.status = status;
      task.last_error = lastError;
      task.finished_at = finishedAt;
      task.claimed_by = null;
      task.claimed_at = null;
      task.lease_until = null;
      task.updated_at = now;
      return { rows: [cloneTask(task)] };
    }

    throw new Error(`Unexpected SQL in FakePgClient: ${sql}`);
  }

  getTask(taskId: string): WorkerTaskRow | undefined {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    return task ? cloneTask(task) : undefined;
  }
}

function cloneTask(task: WorkerTaskRow): WorkerTaskRow {
  return {
    ...task,
    claimed_at: task.claimed_at ? new Date(task.claimed_at) : null,
    lease_until: task.lease_until ? new Date(task.lease_until) : null,
    created_at: new Date(task.created_at),
    updated_at: new Date(task.updated_at),
    started_at: task.started_at ? new Date(task.started_at) : null,
    finished_at: task.finished_at ? new Date(task.finished_at) : null,
  };
}

function createTask(overrides: Partial<WorkerTaskRow> = {}): WorkerTaskRow {
  return {
    id: "task_postgres_001",
    kind: "generate_video",
    status: "queued",
    payload: JSON.stringify({
      projectId: "project_postgres",
      versionId: "version_postgres",
      sourceUrl: "https://example.com",
      templateId: "product-demo",
    }),
    result: null,
    priority: 0,
    claimed_by: null,
    claimed_at: null,
    lease_until: null,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    created_at: new Date("2026-04-19T03:04:05.000Z"),
    updated_at: new Date("2026-04-19T03:04:05.000Z"),
    started_at: null,
    finished_at: null,
    ...overrides,
  };
}

function createDryRunResult(taskId: string): DryRunWorkspaceResult & { mode: "dry-run" } {
  return {
    mode: "dry-run",
    taskId,
    workspaceDir: `D:/tmp/${taskId}`,
    manifestPath: `D:/tmp/${taskId}/manifest.json`,
    taskPath: `D:/tmp/${taskId}/task.json`,
  };
}

test("requires a database url unless a client is injected", async () => {
  await assert.rejects(async () => {
    createPostgresQueueAdapter({
      workerId: "worker_missing_db",
      env: {},
    });
  }, /DATABASE_URL is required/);
});

test("claims a queued task, marks it running, and completes it", async () => {
  const client = new FakePgClient([createTask()]);
  const adapter = createPostgresQueueAdapter({
    client,
    workerId: "worker_postgres_test",
    leaseDurationMs: 60_000,
    now: () => new Date("2026-04-19T04:05:06.000Z"),
  });

  const claim = await adapter.claimNext();
  assert.ok(claim);
  assert.equal(claim.task.id, "task_postgres_001");
  assert.equal(claim.task.status, "claimed");

  const claimedTask = client.getTask("task_postgres_001");
  assert.equal(claimedTask?.status, "claimed");
  assert.equal(claimedTask?.claimed_by, "worker_postgres_test");
  assert.equal(claimedTask?.attempts, 1);

  await adapter.markRunning(claim);
  const runningTask = client.getTask("task_postgres_001");
  assert.equal(runningTask?.status, "running");
  assert.equal(runningTask?.started_at?.toISOString(), "2026-04-19T04:05:06.000Z");

  await adapter.complete(claim, createDryRunResult(claim.task.id));
  const completedTask = client.getTask("task_postgres_001");
  assert.equal(completedTask?.status, "succeeded");
  assert.deepEqual(JSON.parse(completedTask?.result ?? "{}"), {
    mode: "dry-run",
    taskId: "task_postgres_001",
    workspaceDir: "D:/tmp/task_postgres_001",
    manifestPath: "D:/tmp/task_postgres_001/manifest.json",
    taskPath: "D:/tmp/task_postgres_001/task.json",
  });
});

test("requeues failures before max attempts and marks final failure after exhaustion", async () => {
  const client = new FakePgClient([
    createTask({
      id: "task_postgres_retry_001",
      max_attempts: 2,
    }),
  ]);
  const adapter = createPostgresQueueAdapter({
    client,
    workerId: "worker_postgres_retry",
    now: () => new Date("2026-04-19T05:06:07.000Z"),
  });

  const firstClaim = await adapter.claimNext();
  assert.ok(firstClaim);
  await adapter.markRunning(firstClaim);
  await adapter.fail(firstClaim, new Error("temporary failure"));

  const requeuedTask = client.getTask("task_postgres_retry_001");
  assert.equal(requeuedTask?.status, "queued");
  assert.equal(requeuedTask?.claimed_by, null);
  assert.equal(requeuedTask?.last_error, "temporary failure");

  const secondClaim = await adapter.claimNext();
  assert.ok(secondClaim);
  await adapter.markRunning(secondClaim);
  await adapter.fail(secondClaim, new Error("permanent failure"));

  const failedTask = client.getTask("task_postgres_retry_001");
  assert.equal(failedTask?.status, "failed");
  assert.equal(failedTask?.claimed_by, null);
  assert.equal(failedTask?.attempts, 2);
  assert.equal(failedTask?.last_error, "permanent failure");
  assert.ok(failedTask?.finished_at);
});
