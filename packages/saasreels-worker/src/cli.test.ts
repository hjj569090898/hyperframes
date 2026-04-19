import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parseWorkerCliArgs, runWorkerCli } from "./cli.js";

test("parses task file and output dir flags", () => {
  const args = parseWorkerCliArgs(["--task-file", "task.json", "--output-dir", "worker-output"]);

  assert.equal(args.command, "dry-run");
  assert.equal(args.taskFile, "task.json");
  assert.equal(args.outputDir, "worker-output");
});

test("parses enqueue and run-once commands", () => {
  const enqueueArgs = parseWorkerCliArgs([
    "enqueue",
    "--task-file",
    "task.json",
    "--queue-dir",
    "tasks",
  ]);
  const runOnceArgs = parseWorkerCliArgs([
    "run-once",
    "--queue-dir",
    "tasks",
    "--output-dir",
    "output",
  ]);
  const runLoopArgs = parseWorkerCliArgs([
    "run-loop",
    "--queue-dir",
    "tasks",
    "--output-dir",
    "output",
    "--max-iterations",
    "3",
    "--poll-ms",
    "0",
  ]);

  assert.equal(enqueueArgs.command, "enqueue");
  assert.equal(enqueueArgs.queueDir, "tasks");
  assert.equal(runOnceArgs.command, "run-once");
  assert.equal(runOnceArgs.queueDir, "tasks");
  assert.equal(runOnceArgs.outputDir, "output");
  assert.equal(runLoopArgs.command, "run-loop");
  assert.equal(runLoopArgs.maxIterations, 3);
  assert.equal(runLoopArgs.pollMs, 0);
});

test("runs dry-run worker from a task file", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-cli-"));
  try {
    const taskPath = join(tempRoot, "task.json");
    const outputDir = join(tempRoot, "output");
    await writeFile(
      taskPath,
      JSON.stringify({
        id: "task_cli_001",
        kind: "generate_video",
        payload: {
          projectId: "project_cli",
          versionId: "version_cli",
          sourceUrl: "https://example.com",
          templateId: "product-demo",
        },
      }),
      "utf8",
    );

    const result = await runWorkerCli(["--task-file", taskPath, "--output-dir", outputDir]);

    assert.equal(result.taskId, "task_cli_001");

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    assert.equal(manifest.projectId, "project_cli");
    assert.equal(manifest.versionId, "version_cli");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("enqueues a task through the CLI", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-cli-enqueue-"));
  try {
    const taskPath = join(tempRoot, "task.json");
    const queueDir = join(tempRoot, "tasks");
    await writeFile(
      taskPath,
      JSON.stringify({
        id: "task_cli_enqueue_001",
        kind: "generate_video",
        payload: {
          projectId: "project_enqueue",
          versionId: "version_enqueue",
        },
      }),
      "utf8",
    );

    const result = await runWorkerCli([
      "enqueue",
      "--task-file",
      taskPath,
      "--queue-dir",
      queueDir,
    ]);

    assert.equal(result.status, "queued");
    assert.equal(result.taskId, "task_cli_enqueue_001");
    assert.match(result.taskPath, /queued/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("runs one queued task through the CLI", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-cli-run-once-"));
  try {
    const queueDir = join(tempRoot, "tasks");
    const outputDir = join(tempRoot, "output");
    await runWorkerCli([
      "enqueue",
      "--task-json",
      JSON.stringify({
        id: "task_cli_run_once_001",
        kind: "generate_video",
        payload: {
          projectId: "project_run_once",
          versionId: "version_run_once",
        },
      }),
      "--queue-dir",
      queueDir,
    ]);

    const result = await runWorkerCli([
      "run-once",
      "--queue-dir",
      queueDir,
      "--output-dir",
      outputDir,
    ]);

    assert.equal(result.status, "succeeded");
    assert.equal(result.taskId, "task_cli_run_once_001");
    assert.ok("manifestPath" in result);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("runs queued tasks in a loop through the CLI", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-cli-run-loop-"));
  try {
    const queueDir = join(tempRoot, "tasks");
    const outputDir = join(tempRoot, "output");
    for (const taskId of ["task_cli_loop_001", "task_cli_loop_002"]) {
      await runWorkerCli([
        "enqueue",
        "--task-json",
        JSON.stringify({
          id: taskId,
          kind: "generate_video",
          payload: {
            projectId: `${taskId}_project`,
            versionId: `${taskId}_version`,
          },
        }),
        "--queue-dir",
        queueDir,
      ]);
    }

    const result = await runWorkerCli([
      "run-loop",
      "--queue-dir",
      queueDir,
      "--output-dir",
      outputDir,
      "--max-iterations",
      "5",
      "--poll-ms",
      "0",
    ]);

    assert.equal(result.status, "stopped");
    assert.equal(result.processed, 2);
    assert.equal(result.idleCount, 1);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("reads task files that include a UTF-8 BOM", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-cli-bom-"));
  try {
    const taskPath = join(tempRoot, "task.json");
    await writeFile(
      taskPath,
      "\uFEFF" +
        JSON.stringify({
          id: "task_cli_bom_001",
          kind: "generate_video",
          payload: {
            projectId: "project_bom",
            versionId: "version_bom",
          },
        }),
      "utf8",
    );

    const result = await runWorkerCli([
      "--task-file",
      taskPath,
      "--output-dir",
      join(tempRoot, "output"),
    ]);

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    assert.equal(manifest.projectId, "project_bom");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("runs dry-run worker from inline task json", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-cli-json-"));
  try {
    const result = await runWorkerCli([
      "--task-json",
      JSON.stringify({
        id: "task_cli_json_001",
        kind: "export_video",
        payload: {
          versionId: "version_export",
          renderSpec: { scenes: [] },
        },
      }),
      "--output-dir",
      tempRoot,
    ]);

    const snapshot = JSON.parse(await readFile(result.taskPath, "utf8"));
    assert.equal(snapshot.kind, "export_video");
    assert.equal(snapshot.payload.versionId, "version_export");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
