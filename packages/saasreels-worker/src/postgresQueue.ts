import { hostname } from "node:os";

import { Pool } from "pg";

import type { WorkerExecutionResult, WorkerQueueAdapter, WorkerQueueClaim } from "./queue.js";
import { normalizeWorkerTask } from "./worker.js";

type PostgresTaskStatus = "queued" | "claimed" | "running" | "succeeded" | "failed" | "cancelled";

export type PostgresWorkerTaskRow = {
  id: string;
  kind: string;
  status: PostgresTaskStatus;
  payload: string;
  result: string | null;
  priority: number;
  claimed_by: string | null;
  claimed_at: Date | null;
  lease_until: Date | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
};

export interface PostgresQueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
  end?(): Promise<void>;
}

export type CreatePostgresQueueAdapterOptions = {
  databaseUrl?: string;
  env?: Record<string, string | undefined>;
  workerId?: string;
  leaseDurationMs?: number;
  now?: () => Date;
  client?: PostgresQueryClient;
};

type PostgresQueueClaimState = {
  taskId: string;
};

export type PostgresQueueAdapter = WorkerQueueAdapter<PostgresQueueClaimState> & {
  client: PostgresQueryClient;
};

function stripUtf8Bom(raw: string): string {
  return raw.replace(/^\uFEFF/, "");
}

function resolveDatabaseUrl(options: CreatePostgresQueueAdapterOptions): string {
  const databaseUrl = options.databaseUrl ?? options.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required when queue backend is postgres");
  }
  return databaseUrl;
}

function resolveWorkerId(options: CreatePostgresQueueAdapterOptions): string {
  return (
    options.workerId ??
    options.env?.WORKER_ID ??
    process.env.WORKER_ID ??
    `worker-${hostname()}-${Date.now()}`
  );
}

function toQueueClaim(
  row: PostgresWorkerTaskRow,
  workerId: string,
): WorkerQueueClaim<PostgresQueueClaimState> {
  const payload = JSON.parse(stripUtf8Bom(row.payload));
  return {
    task: normalizeWorkerTask({
      id: row.id,
      kind: row.kind,
      status: row.status,
      payload,
    }),
    workerId,
    claim: {
      taskId: row.id,
    },
  };
}

export function createPostgresQueueAdapter(
  options: CreatePostgresQueueAdapterOptions = {},
): PostgresQueueAdapter {
  const now = options.now ?? (() => new Date());
  const workerId = resolveWorkerId(options);
  const leaseDurationMs = options.leaseDurationMs ?? 5 * 60 * 1000;
  const ownsClient = !options.client;
  const client =
    options.client ??
    new Pool({
      connectionString: resolveDatabaseUrl(options),
    });

  return {
    name: "postgres",
    client,
    async claimNext() {
      const claimedAt = now();
      const leaseUntil = new Date(claimedAt.getTime() + leaseDurationMs);
      const findQuery = `
        SELECT * FROM worker_task
        WHERE (
          status = 'queued'
          OR (status = 'claimed' AND lease_until < $1)
        )
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `;
      const findResult = await client.query<PostgresWorkerTaskRow>(findQuery, [claimedAt]);
      const available = findResult.rows[0];
      if (!available) {
        return null;
      }

      const claimQuery = `
        UPDATE worker_task
        SET
          status = 'claimed',
          claimed_by = $1,
          claimed_at = $2,
          lease_until = $3,
          attempts = attempts + 1,
          updated_at = $2
        WHERE id = $4
          AND (
            status = 'queued'
            OR (status = 'claimed' AND lease_until < $2)
          )
        RETURNING *
      `;
      const claimResult = await client.query<PostgresWorkerTaskRow>(claimQuery, [
        workerId,
        claimedAt,
        leaseUntil,
        available.id,
      ]);
      const claimed = claimResult.rows[0];
      return claimed ? toQueueClaim(claimed, workerId) : null;
    },
    async markRunning(claim) {
      const startedAt = now();
      const query = `
        UPDATE worker_task
        SET
          status = 'running',
          started_at = $1,
          updated_at = $1
        WHERE id = $2
          AND claimed_by = $3
          AND status = 'claimed'
        RETURNING *
      `;
      const result = await client.query<PostgresWorkerTaskRow>(query, [
        startedAt,
        claim.task.id,
        claim.workerId,
      ]);
      if (result.rows.length === 0) {
        throw new Error(`Failed to mark worker task as running: ${claim.task.id}`);
      }
    },
    async complete(claim, result: WorkerExecutionResult) {
      const finishedAt = now();
      const query = `
        UPDATE worker_task
        SET
          status = 'succeeded',
          result = $1,
          finished_at = $2,
          updated_at = $2
        WHERE id = $3
        RETURNING *
      `;
      const updateResult = await client.query<PostgresWorkerTaskRow>(query, [
        JSON.stringify(result),
        finishedAt,
        claim.task.id,
      ]);
      if (updateResult.rows.length === 0) {
        throw new Error(`Failed to mark worker task as succeeded: ${claim.task.id}`);
      }
      return {};
    },
    async fail(claim, error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentResult = await client.query<PostgresWorkerTaskRow>(
        "SELECT * FROM worker_task WHERE id = $1",
        [claim.task.id],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new Error(`Worker task not found: ${claim.task.id}`);
      }

      const finishedAt = now();
      const shouldRetry = current.attempts < current.max_attempts;
      const query = `
        UPDATE worker_task
        SET
          status = $1,
          last_error = $2,
          finished_at = $3,
          claimed_by = NULL,
          claimed_at = NULL,
          lease_until = NULL,
          updated_at = $4
        WHERE id = $5
        RETURNING *
      `;
      const updateResult = await client.query<PostgresWorkerTaskRow>(query, [
        shouldRetry ? "queued" : "failed",
        message,
        shouldRetry ? null : finishedAt,
        finishedAt,
        claim.task.id,
      ]);
      if (updateResult.rows.length === 0) {
        throw new Error(`Failed to mark worker task as failed: ${claim.task.id}`);
      }
      return {};
    },
    async close() {
      if (ownsClient) {
        await client.end?.();
      }
    },
  };
}
