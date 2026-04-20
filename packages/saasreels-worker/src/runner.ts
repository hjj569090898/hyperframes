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
    const payload = claim.task.payload as any;
    // AI-Driven Directing Phase
    // If the payload doesn't look like a RenderSpec (missing scenes), we need to direct it.
    if (!Array.isArray(payload.scenes)) {
      console.log(`[Worker] Task ${claim.task.id} requires AI directing...`);

      const pool = options.postgresClient || (options.queueAdapter as any)?.client;
      if (!pool) throw new Error("No database client available for AI-driven tasks");

      const intents = await fetchProjectIntents(pool, payload.projectId);
      const assets = await fetchProjectAssets(pool, payload.projectId);

      const aiApiKey =
        options.env?.OPENAI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        options.env?.KIMI_API_KEY ||
        process.env.KIMI_API_KEY;
      if (!aiApiKey)
        throw new Error("AI API Key (OPENAI_API_KEY or KIMI_API_KEY) is required for directing");

      const director = new CinematicDirector({
        apiKey: aiApiKey,
        model: options.env?.DIRECTOR_MODEL || process.env.DIRECTOR_MODEL || "gpt-4o",
        endpoint:
          options.env?.AI_ENDPOINT ||
          process.env.AI_ENDPOINT ||
          "https://api.openai.com/v1/chat/completions",
      });

      const generatedSpec = await director.direct({
        sourceUrl: payload.sourceUrl,
        templateId: payload.templateId,
        projectId: payload.projectId,
        brief: payload.angle || (payload.evidencePackage?.brief as string),
        intents,
        assets,
      });

      console.log(
        `[Worker] AI directing completed for ${claim.task.id}. Scenes: ${generatedSpec.scenes.length}`,
      );

      // Update video_version with the generated spec
      await pool.query(
        "UPDATE video_version SET render_spec = $1, updated_at = NOW() WHERE id = $2",
        [JSON.stringify(generatedSpec), payload.versionId],
      );

      // Inject generated spec back into task for materialization
      claim.task.payload = generatedSpec as any;
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
    const spec = claim.task.payload as unknown as RenderSpec;
    if (spec.assets) {
      await prepareWorkspaceAssets(spec.assets, dryRunResult.workspaceDir, cacheDir);
    }

    const projectDir = resolve(dryRunResult.workspaceDir);
    const outputFileName = `render_${claim.task.id}.mp4`;
    const outputPath = resolve(join(projectDir, outputFileName));

    const renderJob = createRenderJob({
      input: join(projectDir, "index.html"),
      output: outputPath,
      width: 1920,
      height: 1080,
      fps: 30,
    });

    await executeRenderJob(renderJob, projectDir, outputPath);

    // Optional R2 Upload
    let videoUrl = outputPath;
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_DOMAIN } =
      options.env ?? process.env;

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
    const pool = options.postgresClient || (options.queueAdapter as any)?.client;
    if (pool) {
      await pool.query(
        "UPDATE video_version SET status = 'draft', updated_at = NOW() WHERE id = $1",
        [payload.versionId],
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
