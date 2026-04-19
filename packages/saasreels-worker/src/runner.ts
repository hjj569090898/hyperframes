import {
  claimNextLocalTask,
  completeLocalTask,
  failLocalTask,
  type LocalQueueOptions,
} from "./localQueue.js";
import {
  materializeDryRunWorkspace,
  type DryRunWorkspaceOptions,
  type DryRunWorkspaceResult,
} from "./worker.js";

export type WorkerRunOnceOptions = LocalQueueOptions &
  Pick<DryRunWorkspaceOptions, "outputRoot" | "now"> & {
    workerId?: string;
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
      resultPath: string;
    })
  | {
      status: "failed";
      taskId: string;
      errorPath: string;
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

export async function runWorkerOnce(
  options: WorkerRunOnceOptions = {},
): Promise<WorkerRunOnceResult> {
  const claim = await claimNextLocalTask({
    queueRoot: options.queueRoot,
    workerId: options.workerId,
  });
  if (!claim) {
    return { status: "idle" };
  }

  try {
    const dryRunResult = await materializeDryRunWorkspace(claim.task, {
      outputRoot: options.outputRoot,
      now: options.now,
    });
    const completed = await completeLocalTask(claim, dryRunResult);
    return {
      status: "succeeded",
      ...dryRunResult,
      resultPath: completed.resultPath,
    };
  } catch (error) {
    const failed = await failLocalTask(claim, error);
    return {
      status: "failed",
      taskId: claim.task.id,
      errorPath: failed.errorPath,
      message: error instanceof Error ? error.message : String(error),
    };
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

  while (iterations < maxIterations) {
    const result = await runWorkerOnce(options);
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
