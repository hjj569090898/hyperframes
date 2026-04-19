import type { LocalQueueOptions } from "./localQueue.js";
import {
  createLocalQueueAdapter,
  type WorkerQueueAdapter,
  type WorkerQueueBackend,
} from "./queue.js";
import { createPostgresQueueAdapter, type PostgresQueryClient } from "./postgresQueue.js";
import {
  materializeDryRunWorkspace,
  type DryRunWorkspaceOptions,
  type DryRunWorkspaceResult,
} from "./worker.js";

export type WorkerRunOnceOptions = LocalQueueOptions &
  Pick<DryRunWorkspaceOptions, "outputRoot" | "now"> & {
    workerId?: string;
    queueBackend?: WorkerQueueBackend;
    databaseUrl?: string;
    leaseDurationMs?: number;
    env?: Record<string, string | undefined>;
    postgresClient?: PostgresQueryClient;
    queueAdapter?: WorkerQueueAdapter;
  };

export type WorkerRunLoopOptions = WorkerRunOnceOptions & {
  maxIterations?: number;
  pollMs?: number;
};

export type WorkerRunOnceResult =
  | {
      status: "idle";
    }
  | (DryRunWorkspaceResult & {
      status: "succeeded";
      resultPath?: string;
    })
  | {
      status: "failed";
      taskId: string;
      errorPath?: string;
      message: string;
    };

export type WorkerRunLoopResult = {
  status: "stopped";
  iterations: number;
  processed: number;
  succeeded: number;
  failed: number;
  idleCount: number;
  lastResult?: WorkerRunOnceResult;
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveQueueAdapter(options: WorkerRunOnceOptions): {
  adapter: WorkerQueueAdapter;
  shouldClose: boolean;
} {
  if (options.queueAdapter) {
    return {
      adapter: options.queueAdapter,
      shouldClose: false,
    };
  }

  if (options.queueBackend === "postgres") {
    return {
      adapter: createPostgresQueueAdapter({
        databaseUrl: options.databaseUrl,
        env: options.env,
        workerId: options.workerId,
        leaseDurationMs: options.leaseDurationMs,
        now: options.now,
        client: options.postgresClient,
      }),
      shouldClose: true,
    };
  }

  return {
    adapter: createLocalQueueAdapter({
      queueRoot: options.queueRoot,
      workerId: options.workerId,
    }),
    shouldClose: true,
  };
}

async function runWorkerOnceWithAdapter(
  adapter: WorkerQueueAdapter,
  options: WorkerRunOnceOptions,
): Promise<WorkerRunOnceResult> {
  const claim = await adapter.claimNext();
  if (!claim) {
    return { status: "idle" };
  }

  await adapter.markRunning(claim);

  try {
    const dryRunResult = await materializeDryRunWorkspace(claim.task, {
      outputRoot: options.outputRoot,
      now: options.now,
    });
    const completed = await adapter.complete(claim, {
      mode: "dry-run",
      ...dryRunResult,
    });
    return {
      status: "succeeded",
      ...dryRunResult,
      resultPath: completed.resultPath,
    };
  } catch (error) {
    const failed = await adapter.fail(claim, error);
    return {
      status: "failed",
      taskId: claim.task.id,
      errorPath: failed.errorPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runWorkerOnce(
  options: WorkerRunOnceOptions = {},
): Promise<WorkerRunOnceResult> {
  const { adapter, shouldClose } = resolveQueueAdapter(options);
  try {
    return await runWorkerOnceWithAdapter(adapter, options);
  } finally {
    if (shouldClose) {
      await adapter.close?.();
    }
  }
}

export async function runWorkerLoop(
  options: WorkerRunLoopOptions = {},
): Promise<WorkerRunLoopResult> {
  const maxIterations = options.maxIterations ?? Number.POSITIVE_INFINITY;
  const pollMs = options.pollMs ?? 1000;
  let iterations = 0;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let idleCount = 0;
  let lastResult: WorkerRunOnceResult | undefined;
  const { adapter, shouldClose } = resolveQueueAdapter(options);

  try {
    while (iterations < maxIterations) {
      const result = await runWorkerOnceWithAdapter(adapter, options);
      lastResult = result;
      iterations += 1;

      if (result.status === "idle") {
        idleCount += 1;
        break;
      }

      processed += 1;
      if (result.status === "succeeded") {
        succeeded += 1;
      } else {
        failed += 1;
      }

      await sleep(pollMs);
    }
  } finally {
    if (shouldClose) {
      await adapter.close?.();
    }
  }

  return {
    status: "stopped",
    iterations,
    processed,
    succeeded,
    failed,
    idleCount,
    lastResult,
  };
}
