#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { enqueueLocalTask } from "./localQueue.js";
import { WORKER_QUEUE_BACKENDS, type WorkerQueueBackend } from "./queue.js";
import {
  runWorkerLoop,
  runWorkerOnce,
  type WorkerRunLoopResult,
  type WorkerRunOnceResult,
} from "./runner.js";
import {
  materializeDryRunWorkspace,
  normalizeWorkerTask,
  type DryRunWorkspaceResult,
} from "./worker.js";

export type WorkerCliCommand = "dry-run" | "enqueue" | "run-once" | "run-loop";

export type WorkerCliArgs = {
  command: WorkerCliCommand;
  taskFile?: string;
  taskJson?: string;
  outputDir?: string;
  queueDir?: string;
  workerId?: string;
  maxIterations?: number;
  pollMs?: number;
  queueBackend?: WorkerQueueBackend;
  databaseUrl?: string;
  leaseMs?: number;
};

export type WorkerCliResult =
  | (DryRunWorkspaceResult & { status: "materialized" })
  | { status: "queued"; taskId: string; taskPath: string }
  | WorkerRunLoopResult
  | WorkerRunOnceResult;

function readFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readNumberFlagValue(argv: string[], index: number, flag: string): number {
  const raw = readFlagValue(argv, index, flag);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid numeric value for ${flag}: ${raw}`);
  }
  return value;
}

function readQueueBackendFlagValue(argv: string[], index: number): WorkerQueueBackend {
  const value = readFlagValue(argv, index, "--queue-backend");
  if (WORKER_QUEUE_BACKENDS.includes(value as WorkerQueueBackend)) {
    return value as WorkerQueueBackend;
  }
  throw new Error(`Unsupported queue backend: ${value}`);
}

export function parseWorkerCliArgs(argv: string[]): WorkerCliArgs {
  const firstToken = argv[0];
  const command: WorkerCliCommand =
    firstToken === "enqueue" ||
    firstToken === "run-once" ||
    firstToken === "run-loop" ||
    firstToken === "dry-run"
      ? firstToken
      : "dry-run";
  const startIndex = command === "dry-run" && firstToken !== "dry-run" ? 0 : 1;
  const args: WorkerCliArgs = { command };

  for (let index = startIndex; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--task-file") {
      args.taskFile = readFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--task-json") {
      args.taskJson = readFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--output-dir") {
      args.outputDir = readFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--queue-dir") {
      args.queueDir = readFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--worker-id") {
      args.workerId = readFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--max-iterations") {
      args.maxIterations = readNumberFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--poll-ms") {
      args.pollMs = readNumberFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--queue-backend") {
      args.queueBackend = readQueueBackendFlagValue(argv, index);
      index += 1;
      continue;
    }
    if (token === "--database-url") {
      args.databaseUrl = readFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--lease-ms") {
      args.leaseMs = readNumberFlagValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (
    args.command !== "run-once" &&
    args.command !== "run-loop" &&
    !args.taskFile &&
    !args.taskJson
  ) {
    throw new Error("Provide --task-file <path> or --task-json <json>");
  }
  if (args.taskFile && args.taskJson) {
    throw new Error("Use only one task source: --task-file or --task-json");
  }

  return args;
}

async function readTaskJson(args: WorkerCliArgs): Promise<unknown> {
  const raw = args.taskFile ? await readFile(args.taskFile, "utf8") : args.taskJson;
  if (!raw) {
    throw new Error("Task JSON is empty");
  }
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

export async function runWorkerCli(argv: string[]): Promise<WorkerCliResult> {
  const args = parseWorkerCliArgs(argv);
  if (args.command === "enqueue" && args.queueBackend === "postgres") {
    throw new Error("enqueue only supports the local queue backend in this phase");
  }
  if (args.command === "run-once") {
    return runWorkerOnce({
      queueRoot: args.queueDir,
      outputRoot: args.outputDir,
      workerId: args.workerId,
      queueBackend: args.queueBackend,
      databaseUrl: args.databaseUrl,
      leaseDurationMs: args.leaseMs,
    });
  }
  if (args.command === "run-loop") {
    return runWorkerLoop({
      queueRoot: args.queueDir,
      outputRoot: args.outputDir,
      workerId: args.workerId,
      maxIterations: args.maxIterations,
      pollMs: args.pollMs,
      queueBackend: args.queueBackend,
      databaseUrl: args.databaseUrl,
      leaseDurationMs: args.leaseMs,
    });
  }

  const rawTask = await readTaskJson(args);
  const task = normalizeWorkerTask(rawTask);
  if (args.command === "enqueue") {
    const queued = await enqueueLocalTask(task, {
      queueRoot: args.queueDir,
    });
    return {
      status: "queued",
      taskId: queued.task.id,
      taskPath: queued.taskPath,
    };
  }

  return {
    status: "materialized",
    ...(await materializeDryRunWorkspace(task, {
      outputRoot: args.outputDir,
    })),
  };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isMainModule()) {
  runWorkerCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`saasreels-worker failed: ${message}\n`);
      process.exitCode = 1;
    });
}
