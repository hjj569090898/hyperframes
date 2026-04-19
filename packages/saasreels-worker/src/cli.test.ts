import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { parseWorkerCliArgs, runWorkerCli } from "./cli.js";

test("parses task file and output dir flags", () => {
  const args = parseWorkerCliArgs(["--task-file", "task.json", "--output-dir", "worker-output"]);

  assert.equal(args.taskFile, "task.json");
  assert.equal(args.outputDir, "worker-output");
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
