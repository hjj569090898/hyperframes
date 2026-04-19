#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  materializeDryRunWorkspace,
  normalizeWorkerTask,
  type DryRunWorkspaceResult,
} from "./worker.js";

export type WorkerCliArgs = {
  taskFile?: string;
  taskJson?: string;
  outputDir?: string;
};

function readFlagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function parseWorkerCliArgs(argv: string[]): WorkerCliArgs {
  const args: WorkerCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
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
    if (token === "--dry-run") {
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.taskFile && !args.taskJson) {
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

export async function runWorkerCli(argv: string[]): Promise<DryRunWorkspaceResult> {
  const args = parseWorkerCliArgs(argv);
  const rawTask = await readTaskJson(args);
  const task = normalizeWorkerTask(rawTask);
  return materializeDryRunWorkspace(task, {
    outputRoot: args.outputDir,
  });
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
