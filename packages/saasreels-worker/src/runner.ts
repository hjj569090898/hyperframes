import type { LocalQueueOptions } from "./localQueue.js";
import {
  createLocalQueueAdapter,
  type WorkerQueueAdapter,
  type WorkerQueueBackend,
} from "./queue.js";
import { createPostgresQueueAdapter, type PostgresQueryClient } from "./postgresQueue.js";
import {
  materializeDryRunWorkspace,
  type DryRunWorkspaceOptions,
  type DryRunWorkspaceResult,
} from "./worker.js";
import { createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { join, resolve } from "node:path";
import { prepareWorkspaceAssets } from "./assets.js";
import { fetchProjectAssets, fetchProjectIntents } from "./db.js";
import { CinematicDirector } from "./director.js";
import { validateRenderSpecOrThrow } from "./renderSpecValidation.js";
import type { RenderSpec } from "./translate.js";

export type WorkerRunOnceOptions = LocalQueueOptions &
  Pick<DryRunWorkspaceOptions, "outputRoot" | "now"> & {
    workerId?: string;
    queueBackend?: WorkerQueueBackend;
    databaseUrl?: string;
    leaseDurationMs?: number;
    env?: Record<string, string | undefined>;
    postgresClient?: PostgresQueryClient;
    queueAdapter?: WorkerQueueAdapter;
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
      resultPath?: string;
    })
  | {
      status: "failed";
      taskId: string;
      errorPath?: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPostgresQueryClient(value: unknown): value is PostgresQueryClient {
  return isRecord(value) && typeof value.query === "function";
}

function adapterHasClient(
  adapter: WorkerQueueAdapter,
): adapter is WorkerQueueAdapter & { client: PostgresQueryClient } {
  return "client" in adapter && isPostgresQueryClient(adapter.client);
}

function getPostgresClient(
  adapter: WorkerQueueAdapter,
  options: WorkerRunOnceOptions,
): PostgresQueryClient | null {
  if (options.postgresClient) return options.postgresClient;
  if (options.queueAdapter && adapterHasClient(options.queueAdapter))
    return options.queueAdapter.client;
  if (adapterHasClient(adapter)) return adapter.client;
  return null;
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getPositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function getBrief(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.angle === "string") return payload.angle;
  if (isRecord(payload.evidencePackage) && typeof payload.evidencePackage.brief === "string") {
    return payload.evidencePackage.brief;
  }
  return undefined;
}

function getTargetDurationSeconds(payload: Record<string, unknown>): number | undefined {
  const topLevel = getPositiveNumber(payload.targetDurationSeconds);
  if (topLevel !== undefined) return topLevel;

  const shorthand = getPositiveNumber(payload.targetDuration);
  if (shorthand !== undefined) return shorthand;

  if (isRecord(payload.evidencePackage)) {
    const nested = getPositiveNumber(payload.evidencePackage.targetDurationSeconds);
    if (nested !== undefined) return nested;
  }

  return undefined;
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

function resolveRenderSpecPayload(payload: Record<string, unknown>): RenderSpec | null {
  if (looksLikeCompleteRenderSpec(payload)) {
    return validateRenderSpecOrThrow(payload);
  }

  if (looksLikeCompleteRenderSpec(payload.renderSpec)) {
    return validateRenderSpecOrThrow(payload.renderSpec);
  }

  return null;
}

function resolveQueueAdapter(options: WorkerRunOnceOptions): {
  adapter: WorkerQueueAdapter;
  shouldClose: boolean;
} {
  if (options.queueAdapter) {
    return {
      adapter: options.queueAdapter,
      shouldClose: false,
    };
  }

  if (options.queueBackend === "postgres") {
    return {
      adapter: createPostgresQueueAdapter({
        databaseUrl: options.databaseUrl,
        env: options.env,
        workerId: options.workerId,
        leaseDurationMs: options.leaseDurationMs,
        now: options.now,
        client: options.postgresClient,
      }),
      shouldClose: true,
    };
  }

  return {
    adapter: createLocalQueueAdapter({
      queueRoot: options.queueRoot,
      workerId: options.workerId,
    }),
    shouldClose: true,
  };
}

async function runWorkerOnceWithAdapter(
  adapter: WorkerQueueAdapter,
  options: WorkerRunOnceOptions,
): Promise<WorkerRunOnceResult> {
  const claim = await adapter.claimNext();
  if (!claim) {
    return { status: "idle" };
  }

  await adapter.markRunning(claim);

  try {
    const payload = claim.task.payload;
    let renderSpec = resolveRenderSpecPayload(payload);
    // AI-Driven Directing Phase
    // If the payload is only project/version metadata, use the director when a DB client is available.
    if (!renderSpec) {
      const pool = getPostgresClient(adapter, options);
      if (pool) {
        console.log(`[Worker] Task ${claim.task.id} requires AI directing...`);

        const projectId = getString(payload.projectId);
        const versionId = getString(payload.versionId);
        const intents = await fetchProjectIntents(pool, projectId);
        const assets = await fetchProjectAssets(pool, projectId);

        const hasKimiKey = Boolean(options.env?.KIMI_API_KEY || process.env.KIMI_API_KEY);
        const aiApiKey =
          options.env?.KIMI_API_KEY ||
          process.env.KIMI_API_KEY ||
          options.env?.OPENAI_API_KEY ||
          process.env.OPENAI_API_KEY;

        const aiModel = hasKimiKey
          ? options.env?.KIMI_MODEL || process.env.KIMI_MODEL || "moonshot-v1-8k-vision-preview"
          : options.env?.OPENAI_MODEL || process.env.OPENAI_MODEL || "gpt-4o";

        const aiEndpoint = hasKimiKey
          ? options.env?.KIMI_ENDPOINT ||
            process.env.KIMI_ENDPOINT ||
            "https://api.moonshot.cn/v1/chat/completions"
          : options.env?.OPENAI_ENDPOINT ||
            process.env.OPENAI_ENDPOINT ||
            "https://api.openai.com/v1/chat/completions";

        const director = new CinematicDirector({
          apiKey: aiApiKey || "",
          model: aiModel,
          endpoint: aiEndpoint,
        });

        const generatedSpec = await director.direct({
          sourceUrl: getString(payload.sourceUrl),
          templateId: getString(payload.templateId),
          projectId,
          brief: getBrief(payload),
          targetDurationSeconds: getTargetDurationSeconds(payload),
          intents,
          assets,
        });
        renderSpec = validateRenderSpecOrThrow(generatedSpec);

        console.log(
          `[Worker] AI directing completed for ${claim.task.id}. Scenes: ${renderSpec.scenes.length}`,
        );

        await pool.query(
          "UPDATE video_version SET render_spec = $1, updated_at = NOW() WHERE id = $2",
          [JSON.stringify(renderSpec), versionId],
        );

        claim.task.payload = { ...renderSpec };
      } else {
        console.log(
          `[Worker] Task ${claim.task.id} has no complete RenderSpec; running local dry-run materialization.`,
        );
      }
    }

    const dryRunResult = await materializeDryRunWorkspace(claim.task, {
      outputRoot: options.outputRoot,
      now: options.now,
    });

    // Prepare Assets
    const cacheDir = resolve(
      options.outputRoot ?? join(process.cwd(), ".tmp", "saasreels-worker"),
      "cache",
    );
    if (renderSpec?.assets) {
      await prepareWorkspaceAssets(renderSpec.assets, dryRunResult.workspaceDir, cacheDir);
    }

    const projectDir = resolve(dryRunResult.workspaceDir);
    const outputFileName = `render_${claim.task.id}.mp4`;
    const outputPath = resolve(join(projectDir, outputFileName));

    const renderJob = createRenderJob({
      fps: 30,
      quality: "draft",
      workers: 1,
      entryFile: "index.html",
    });

    await executeRenderJob(renderJob, projectDir, outputPath);

    // Optional R2 Upload
    let videoUrl = outputPath;
    const R2_ACCOUNT_ID = options.env?.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
    const R2_ACCESS_KEY_ID =
      options.env?.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY;
    const R2_SECRET_ACCESS_KEY =
      options.env?.R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_KEY;
    const R2_BUCKET = options.env?.R2_BUCKET || process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
    const R2_PUBLIC_DOMAIN =
      options.env?.R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_DOMAIN || process.env.R2_DOMAIN;

    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
      try {
        const { R2Storage } = await import("./storage.js");
        const storage = new R2Storage({
          accountId: R2_ACCOUNT_ID,
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
          bucket: R2_BUCKET,
          publicDomain: R2_PUBLIC_DOMAIN,
        });
        const key = `renders/${claim.task.id}.mp4`;
        videoUrl = await storage.uploadVideo(outputPath, key);
        console.log(`[Storage] Uploaded video to: ${videoUrl}`);
      } catch (uploadError) {
        console.error(`[Storage] Failed to upload to R2, falling back to local path:`, uploadError);
      }
    }

    const completed = await adapter.complete(claim, {
      mode: "production",
      ...dryRunResult,
      videoPath: outputPath,
      videoUrl: videoUrl,
    });

    // Update video_version to DRAFT/COMPLETED and set the preview URL
    const pool = getPostgresClient(adapter, options);
    if (pool) {
      await pool.query(
        "UPDATE video_version SET status = 'draft', exported_url = $2, updated_at = NOW() WHERE id = $1",
        [getString(payload.versionId), videoUrl],
      );
    }

    return {
      status: "succeeded",
      ...dryRunResult,
      resultPath: completed.resultPath,
    };
  } catch (error) {
    const failed = await adapter.fail(claim, error);
    return {
      status: "failed",
      taskId: claim.task.id,
      errorPath: failed.errorPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runWorkerOnce(
  options: WorkerRunOnceOptions = {},
): Promise<WorkerRunOnceResult> {
  const { adapter, shouldClose } = resolveQueueAdapter(options);
  try {
    return await runWorkerOnceWithAdapter(adapter, options);
  } finally {
    if (shouldClose) {
      await adapter.close?.();
    }
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
  const { adapter, shouldClose } = resolveQueueAdapter(options);
  let shouldStop = false;

  const shutdown = () => {
    console.log("[Worker] Shutdown signal received. Finishing current task...");
    shouldStop = true;
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    while (iterations < maxIterations && !shouldStop) {
      const result = await runWorkerOnceWithAdapter(adapter, options);
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

      if (!shouldStop) {
        await sleep(pollMs);
      }
    }
  } finally {
    process.off("SIGTERM", shutdown);
    process.off("SIGINT", shutdown);
    if (shouldClose) {
      await adapter.close?.();
    }
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
