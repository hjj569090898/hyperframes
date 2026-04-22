import {
  claimNextLocalTask,
  completeLocalTask,
  failLocalTask,
  type LocalQueueOptions,
  type LocalTaskClaim,
} from "./localQueue.js";
import { type SaasReelsWorkerTask } from "./worker.js";

export const WORKER_QUEUE_BACKENDS = ["local", "postgres"] as const;
export type WorkerQueueBackend = (typeof WORKER_QUEUE_BACKENDS)[number];

export type WorkerExecutionResult = Record<string, unknown>;
export type WorkerQueueCompleteResult = Record<string, unknown> & {
  resultPath?: string;
};
export type WorkerQueueFailureResult = Record<string, unknown> & {
  errorPath?: string;
};

export interface WorkerQueueClaim<T = unknown> {
  task: SaasReelsWorkerTask;
  workerId: string;
  claim: T;
}

export interface WorkerQueueAdapter<T = unknown> {
  name: string;
  claimNext(): Promise<WorkerQueueClaim<T> | null>;
  markRunning(claim: WorkerQueueClaim<T>): Promise<void>;
  complete(
    claim: WorkerQueueClaim<T>,
    result: WorkerExecutionResult,
  ): Promise<WorkerQueueCompleteResult>;
  fail(claim: WorkerQueueClaim<T>, error: unknown): Promise<WorkerQueueFailureResult>;
  close?(): Promise<void>;
}

export type CreateLocalQueueAdapterOptions = LocalQueueOptions & {
  workerId?: string;
};

export function createLocalQueueAdapter(
  options: CreateLocalQueueAdapterOptions = {},
): WorkerQueueAdapter<LocalTaskClaim> {
  return {
    name: "local",
    async claimNext() {
      const claim = await claimNextLocalTask(options);
      if (!claim) return null;
      return {
        task: claim.task,
        workerId: claim.workerId,
        claim,
      };
    },
    async markRunning(_claim) {
      // Local queue updates status to 'running' immediately on claim
    },
    async complete(claim, result) {
      const completed = await completeLocalTask(claim.claim, result);
      return { resultPath: completed.resultPath };
    },
    async fail(claim, error) {
      const failed = await failLocalTask(claim.claim, error);
      return { errorPath: failed.errorPath };
    },
  };
}
