import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRenderSpecOrThrow } from "./renderSpecValidation.js";
import { translateRenderSpecToHtml, type RenderSpec } from "./translate.js";

export const SAASREELS_WORKER_TASK_KINDS = ["generate_video", "export_video"] as const;

export type SaasReelsWorkerTaskKind = (typeof SAASREELS_WORKER_TASK_KINDS)[number];

export type WorkerTaskStatus =
  | "queued"
  | "claimed"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type SaasReelsWorkerTask = {
  id: string;
  kind: SaasReelsWorkerTaskKind;
  status: WorkerTaskStatus;
  payload: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type DryRunWorkspaceOptions = {
  outputRoot?: string;
  now?: () => Date;
};

export type DryRunWorkspaceResult = {
  taskId: string;
  workspaceDir: string;
  manifestPath: string;
  taskPath: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeCompleteRenderSpec(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.scenes) &&
    "fps" in value &&
    "format" in value &&
    "totalFrames" in value
  );
}

function defaultDryRunRenderSpec(): RenderSpec {
  return {
    fps: 30,
    format: "16:9",
    totalFrames: 30,
    scenes: [],
  };
}

function resolveRenderSpecForMaterialization(payload: Record<string, unknown>): RenderSpec {
  if (looksLikeCompleteRenderSpec(payload)) {
    return validateRenderSpecOrThrow(payload);
  }

  const nestedRenderSpec = payload.renderSpec;
  if (looksLikeCompleteRenderSpec(nestedRenderSpec)) {
    return validateRenderSpecOrThrow(nestedRenderSpec);
  }

  return defaultDryRunRenderSpec();
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required string field: ${fieldName}`);
  }
  return value;
}

function isSupportedTaskKind(kind: string): kind is SaasReelsWorkerTaskKind {
  return SAASREELS_WORKER_TASK_KINDS.includes(kind as SaasReelsWorkerTaskKind);
}

function validatePayload(kind: SaasReelsWorkerTaskKind, payload: Record<string, unknown>): void {
  if (kind === "generate_video") {
    requireString(payload.projectId, "payload.projectId");
    requireString(payload.versionId, "payload.versionId");
    return;
  }

  requireString(payload.versionId, "payload.versionId");
}

export function sanitizeTaskId(taskId: string): string {
  const sanitized = taskId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return sanitized || "task";
}

async function copyBundledGsap(workspaceDir: string): Promise<void> {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const packageDir = resolve(moduleDir, "..");
  const candidates = [join(packageDir, "gsap.min.js"), join(packageDir, "assets", "gsap.js")];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      await copyFile(candidate, join(workspaceDir, "gsap.js"));
      return;
    } catch {
      // Try the next bundled candidate.
    }
  }

  throw new Error(`Unable to find bundled gsap.js in ${packageDir}`);
}

export function normalizeWorkerTask(input: unknown): SaasReelsWorkerTask {
  if (!isRecord(input)) {
    throw new Error("Worker task must be an object");
  }

  const id = requireString(input.id, "id");
  const rawKind = requireString(input.kind, "kind");
  if (!isSupportedTaskKind(rawKind)) {
    throw new Error(`Unsupported worker task kind: ${rawKind}`);
  }

  if (!isRecord(input.payload)) {
    throw new Error("Missing required object field: payload");
  }
  validatePayload(rawKind, input.payload);

  const rawStatus = input.status;
  const status =
    typeof rawStatus === "string" && rawStatus.trim().length > 0
      ? (rawStatus as WorkerTaskStatus)
      : "queued";

  return {
    id,
    kind: rawKind,
    status,
    payload: input.payload,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : undefined,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : undefined,
  };
}

export async function materializeDryRunWorkspace(
  task: SaasReelsWorkerTask,
  options: DryRunWorkspaceOptions = {},
): Promise<DryRunWorkspaceResult> {
  const outputRoot = resolve(options.outputRoot ?? join(process.cwd(), ".tmp", "saasreels-worker"));
  const workspaceDir = join(outputRoot, sanitizeTaskId(task.id));
  const now = options.now ?? (() => new Date());
  const generatedAt = now().toISOString();

  await mkdir(workspaceDir, { recursive: true });

  try {
    await copyBundledGsap(workspaceDir);
  } catch (error) {
    console.warn("[Materializer] Failed to copy gsap.js to workspace:", error);
  }

  const manifest = {
    schemaVersion: "saasreels-worker.dry-run.v1",
    taskId: task.id,
    kind: task.kind,
    status: "materialized",
    projectId: typeof task.payload.projectId === "string" ? task.payload.projectId : null,
    versionId: typeof task.payload.versionId === "string" ? task.payload.versionId : null,
    generatedAt,
    workspaceDir,
  };

  const taskPath = join(workspaceDir, "task.json");
  const manifestPath = join(workspaceDir, "manifest.json");
  const indexPath = join(workspaceDir, "index.html");

  const renderSpec = resolveRenderSpecForMaterialization(task.payload);
  const html = translateRenderSpecToHtml(renderSpec);

  await writeFile(taskPath, JSON.stringify(task, null, 2) + "\n", "utf8");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await writeFile(indexPath, html, "utf8");

  return {
    taskId: task.id,
    workspaceDir,
    manifestPath,
    taskPath,
  };
}
