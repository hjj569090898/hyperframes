import {
  claimNextLocalTask,
  completeLocalTask,
  failLocalTask,
  type LocalQueueOptions,
  type LocalTaskClaim,
} from "./localQueue.js";
import type { DryRunWorkspaceResult, SaasReelsWorkerTask } from "./worker.js";

export const WORKER_QUEUE_BACKENDS = ["local", "postgres"] as const;

export type WorkerQueueBackend = (typeof WORKER_QUEUE_BACKENDS)[number];

export type WorkerExecutionResult = DryRunWorkspaceResult & {
  mode: "dry-run";
};

export type WorkerQueueClaim<TClaim = unknown> = {
  task: SaasReelsWorkerTask;
  workerId: string;
  claim: TClaim;
};

export type WorkerQueueCompleteResult = {
  resultPath?: string;
};

export type WorkerQueueFailureResult = {
  errorPath?: string;
};

export interface WorkerQueueAdapter<TClaim = unknown> {
  name: string;
  claimNext(): Promise<WorkerQueueClaim<TClaim> | null>;
  markRunning(claim: WorkerQueueClaim<TClaim>): Promise<void>;
  complete(
    claim: WorkerQueueClaim<TClaim>,
    result: WorkerExecutionResult,
  ): Promise<WorkerQueueCompleteResult>;
  fail(claim: WorkerQueueClaim<TClaim>, error: unknown): Promise<WorkerQueueFailureResult>;
  close?(): Promise<void>;
}

export function createLocalQueueAdapter(
  options: LocalQueueOptions & { workerId?: string } = {},
): WorkerQueueAdapter<LocalTaskClaim> {
  return {
    name: "local",
    async claimNext() {
      const claim = await claimNextLocalTask({
        queueRoot: options.queueRoot,
        workerId: options.workerId,
      });
      if (!claim) {
        return null;
      }

      return {
        task: claim.task,
        workerId: claim.workerId,
        claim,
      };
    },
    async markRunning() {},
    async complete(claim, result) {
      const completed = await completeLocalTask(claim.claim, result);
      return {
        resultPath: completed.resultPath,
      };
    },
    async fail(claim, error) {
      const failed = await failLocalTask(claim.claim, error);
      return {
        errorPath: failed.errorPath,
      };
    },
  };
}
