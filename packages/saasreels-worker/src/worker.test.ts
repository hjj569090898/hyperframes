import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { materializeDryRunWorkspace, normalizeWorkerTask } from "./worker.js";

test("normalizes a saasreels generate_video task payload", () => {
  const task = normalizeWorkerTask({
    id: "task_generate_001",
    kind: "generate_video",
    payload: {
      projectId: "project_123",
      versionId: "version_456",
      sourceUrl: "https://example.com",
      templateId: "product-demo",
    },
    createdAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
  });

  assert.equal(task.id, "task_generate_001");
  assert.equal(task.kind, "generate_video");
  assert.equal(task.status, "queued");
  assert.equal(task.payload.projectId, "project_123");
  assert.equal(task.payload.versionId, "version_456");
});

test("rejects unsupported worker task kinds", () => {
  assert.throws(
    () =>
      normalizeWorkerTask({
        id: "task_unknown_001",
        kind: "thumbnail_magic",
        payload: {},
      }),
    /Unsupported worker task kind/,
  );
});

test("materializes a dry-run worker workspace with manifest and task snapshot", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-"));
  try {
    const task = normalizeWorkerTask({
      id: "task/generate:001",
      kind: "generate_video",
      payload: {
        projectId: "project_123",
        versionId: "version_456",
        sourceUrl: "https://example.com",
        templateId: "product-demo",
      },
    });

    const result = await materializeDryRunWorkspace(task, {
      outputRoot,
      now: () => new Date("2026-04-19T01:02:03.000Z"),
    });

    assert.equal(result.taskId, "task/generate:001");
    assert.match(result.workspaceDir, /task_generate_001$/);

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    assert.equal(manifest.schemaVersion, "saasreels-worker.dry-run.v1");
    assert.equal(manifest.taskId, "task/generate:001");
    assert.equal(manifest.kind, "generate_video");
    assert.equal(manifest.projectId, "project_123");
    assert.equal(manifest.versionId, "version_456");
    assert.equal(manifest.generatedAt, "2026-04-19T01:02:03.000Z");

    const snapshot = JSON.parse(await readFile(result.taskPath, "utf8"));
    assert.equal(snapshot.payload.templateId, "product-demo");
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("defaults dry-run workspaces under the ignored .tmp directory", async () => {
  const originalCwd = process.cwd();
  const tempRoot = await mkdtemp(join(tmpdir(), "saasreels-worker-default-"));
  try {
    process.chdir(tempRoot);
    const task = normalizeWorkerTask({
      id: "task_default_001",
      kind: "export_video",
      payload: {
        versionId: "version_default",
        renderSpec: { scenes: [] },
      },
    });

    const result = await materializeDryRunWorkspace(task);

    assert.equal(
      result.workspaceDir,
      join(tempRoot, ".tmp", "saasreels-worker", "task_default_001"),
    );
  } finally {
    process.chdir(originalCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
});
