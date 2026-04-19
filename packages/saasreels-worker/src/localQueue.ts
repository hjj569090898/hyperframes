import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { normalizeWorkerTask, sanitizeTaskId, type SaasReelsWorkerTask } from "./worker.js";

export const LOCAL_QUEUE_STATUSES = ["queued", "running", "succeeded", "failed"] as const;

export type LocalQueueStatus = (typeof LOCAL_QUEUE_STATUSES)[number];

export type LocalQueuePaths = {
  rootDir: string;
  queuedDir: string;
  runningDir: string;
  succeededDir: string;
  failedDir: string;
};

export type LocalQueueOptions = {
  queueRoot?: string;
};

export type LocalTaskRecord = {
  task: SaasReelsWorkerTask;
  taskPath: string;
};

export type LocalTaskClaim = LocalTaskRecord & {
  workerId: string;
  queueRoot: string;
  fileName: string;
};

export type CompletedLocalTask = {
  taskPath: string;
  resultPath: string;
};

export type FailedLocalTask = {
  taskPath: string;
  errorPath: string;
};

function withStatus(task: SaasReelsWorkerTask, status: SaasReelsWorkerTask["status"]) {
  return {
    ...task,
    status,
  };
}

function readJsonText(raw: string): unknown {
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function taskFileName(taskId: string): string {
  return `${sanitizeTaskId(taskId)}.json`;
}

function sidecarFileName(taskId: string, suffix: "result" | "error"): string {
  return `${sanitizeTaskId(taskId)}.${suffix}.json`;
}

export function resolveLocalQueuePaths(queueRoot?: string): LocalQueuePaths {
  const rootDir = resolve(queueRoot ?? join(process.cwd(), ".tmp", "saasreels-worker", "tasks"));
  return {
    rootDir,
    queuedDir: join(rootDir, "queued"),
    runningDir: join(rootDir, "running"),
    succeededDir: join(rootDir, "succeeded"),
    failedDir: join(rootDir, "failed"),
  };
}

export async function ensureLocalQueue(queueRoot?: string): Promise<LocalQueuePaths> {
  const paths = resolveLocalQueuePaths(queueRoot);
  await Promise.all(
    LOCAL_QUEUE_STATUSES.map((status) => mkdir(join(paths.rootDir, status), { recursive: true })),
  );
  return paths;
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function enqueueLocalTask(
  rawTask: unknown,
  options: LocalQueueOptions = {},
): Promise<LocalTaskRecord> {
  const paths = await ensureLocalQueue(options.queueRoot);
  const task = withStatus(normalizeWorkerTask(rawTask), "queued");
  const taskPath = join(paths.queuedDir, taskFileName(task.id));
  await writeJsonFile(taskPath, task);
  return { task, taskPath };
}

export async function claimNextLocalTask(
  options: LocalQueueOptions & { workerId?: string } = {},
): Promise<LocalTaskClaim | null> {
  const paths = await ensureLocalQueue(options.queueRoot);
  const fileNames = (await readdir(paths.queuedDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  const fileName = fileNames[0];
  if (!fileName) {
    return null;
  }

  const queuedPath = join(paths.queuedDir, fileName);
  const task = withStatus(
    normalizeWorkerTask(readJsonText(await readFile(queuedPath, "utf8"))),
    "running",
  );
  const runningPath = join(paths.runningDir, fileName);
  await writeJsonFile(runningPath, task);
  await rm(queuedPath, { force: true });

  return {
    task,
    taskPath: runningPath,
    workerId: options.workerId ?? "local-worker",
    queueRoot: paths.rootDir,
    fileName,
  };
}

export async function completeLocalTask(
  claim: LocalTaskClaim,
  result: Record<string, unknown>,
): Promise<CompletedLocalTask> {
  const paths = await ensureLocalQueue(claim.queueRoot);
  const task = withStatus(claim.task, "succeeded");
  const taskPath = join(paths.succeededDir, claim.fileName);
  const resultPath = join(paths.succeededDir, sidecarFileName(task.id, "result"));

  await writeJsonFile(taskPath, task);
  await writeJsonFile(resultPath, result);
  await rm(claim.taskPath, { force: true });

  return { taskPath, resultPath };
}

export async function failLocalTask(
  claim: LocalTaskClaim,
  error: unknown,
): Promise<FailedLocalTask> {
  const paths = await ensureLocalQueue(claim.queueRoot);
  const task = withStatus(claim.task, "failed");
  const taskPath = join(paths.failedDir, claim.fileName);
  const errorPath = join(paths.failedDir, sidecarFileName(task.id, "error"));
  const message = error instanceof Error ? error.message : String(error);

  await writeJsonFile(taskPath, task);
  await writeJsonFile(errorPath, {
    message,
    name: error instanceof Error ? error.name : "Error",
  });
  await rm(claim.taskPath, { force: true });

  return { taskPath, errorPath };
}
