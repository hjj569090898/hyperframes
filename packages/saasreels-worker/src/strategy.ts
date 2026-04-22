import type { ProjectAsset, ProjectIntent } from "./db.js";
import type { PageInsight } from "./scraper.js";
import type { RenderSpec } from "./translate.js";

export type VideoMode = "hook-ad" | "landing-page-summary" | "product-demo";
export type VideoPacing = "fast" | "balanced" | "explanatory";
export type AssetPlanMode = "product-led" | "hybrid" | "stock-supported";
export type StockRole = "supporting-only" | "fallback-primary";

export type VideoStrategy = {
  mode: VideoMode;
  targetDurationSeconds: number;
  sceneCount: number;
  targetTotalFrames: number;
  pacing: VideoPacing;
  reasons: string[];
  assetPlan: {
    mode: AssetPlanMode;
    stockRole: StockRole;
    productEvidenceRequired: boolean;
    preferredAssetIds: string[];
    recommendedPexelsQueries: string[];
  };
};

export type StrategyContext = {
  sourceUrl: string;
  brief?: string;
  intents: ProjectIntent | null;
  assets: ProjectAsset[];
  webpageInsight?: PageInsight;
  targetDurationSeconds?: number;
  fps?: 30 | 60;
};

const HOOK_AD_PATTERN =
  /\b(ad|ads|hook|hooks|short|short-form|performance|ugc|reel|reels|tiktok|teaser|promo)\b|短视频|投放|吸睛|钩子/u;
const PRODUCT_DEMO_PATTERN =
  /\b(demo|walkthrough|tour|onboarding|explainer|tutorial|step-by-step|workflow|product demo)\b|演示|讲解|流程|上手|教程/u;
const DURATION_HINT_PATTERN = /(\d{1,2})(?:\s*)(?:s|sec|secs|second|seconds|秒|帧|frames?)/giu;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseExplicitDurationHint(values: Array<string | undefined>): number | undefined {
  for (const value of values) {
    if (!value) continue;

    for (const match of value.matchAll(DURATION_HINT_PATTERN)) {
      const seconds = Number.parseInt(match[1] ?? "", 10);
      if (!Number.isFinite(seconds) || seconds <= 0) continue;

      const unit = match[0] ?? "";
      if (/帧|frames?/iu.test(unit)) {
        continue;
      }

      return clamp(seconds, 12, 60);
    }
  }

  return undefined;
}

function isVisualAsset(asset: ProjectAsset): boolean {
  return asset.type === "image" || asset.type === "video";
}

function isProductEvidenceAsset(asset: ProjectAsset): boolean {
  if (!isVisualAsset(asset)) return false;
  return asset.intendedRole !== "stock_background";
}

function getPreferredAssetIds(intents: ProjectIntent | null, assets: ProjectAsset[]): string[] {
  const knownIds = new Set(assets.map((asset) => asset.id));
  return (intents?.preferredAssetIds ?? []).filter((assetId) => knownIds.has(assetId));
}

function estimateComplexity(context: StrategyContext): number {
  const mustIncludeCount = context.intents?.mustIncludePoints?.length ?? 0;
  const keywordCount = context.webpageInsight?.keywords.length ?? 0;
  const productAssetCount = context.assets.filter(isProductEvidenceAsset).length;
  const briefLength = context.brief?.length ?? 0;

  let score = 0;
  score += clamp(mustIncludeCount - 1, 0, 4);
  score += clamp(Math.floor(keywordCount / 2), 0, 2);
  score += productAssetCount >= 3 ? 2 : productAssetCount >= 1 ? 1 : 0;
  score += briefLength >= 180 ? 1 : 0;

  return score;
}

function inferMode(context: StrategyContext, reasons: string[]): VideoMode {
  const briefHintText = normalizeSpace([context.brief, context.intents?.slogan ?? ""].join(" "));

  if (HOOK_AD_PATTERN.test(briefHintText)) {
    reasons.push("Detected ad or hook language in the brief.");
    return "hook-ad";
  }

  if (PRODUCT_DEMO_PATTERN.test(briefHintText)) {
    reasons.push("Detected demo or walkthrough language in the brief.");
    return "product-demo";
  }

  if (context.sourceUrl.trim().length > 0) {
    reasons.push("Defaulted source-page work to landing-page-summary mode.");
    return "landing-page-summary";
  }

  reasons.push("No page context found; defaulted to hook-ad mode.");
  return "hook-ad";
}

function inferDurationSeconds(
  context: StrategyContext,
  mode: VideoMode,
  reasons: string[],
): number {
  const explicitDuration =
    context.targetDurationSeconds ??
    parseExplicitDurationHint([
      context.brief,
      context.intents?.slogan ?? undefined,
      ...(context.intents?.mustIncludePoints ?? []),
    ]);

  if (explicitDuration !== undefined) {
    reasons.push(`Honored explicit duration hint (${explicitDuration}s).`);
    return clamp(Math.round(explicitDuration), 12, 60);
  }

  const complexity = estimateComplexity(context);
  if (mode === "hook-ad") {
    return clamp(14 + complexity * 2, 12, 20);
  }
  if (mode === "product-demo") {
    return clamp(32 + complexity * 3, 30, 50);
  }
  return clamp(22 + complexity * 2, 20, 35);
}

function inferSceneCount(durationSeconds: number, mode: VideoMode): number {
  if (mode === "hook-ad") {
    return clamp(Math.round(durationSeconds / 3.5), 4, 5);
  }
  if (mode === "product-demo") {
    return clamp(Math.round(durationSeconds / 5), 6, 9);
  }
  return clamp(Math.round(durationSeconds / 4.5), 5, 7);
}

function inferPacing(durationSeconds: number): VideoPacing {
  if (durationSeconds <= 18) return "fast";
  if (durationSeconds <= 32) return "balanced";
  return "explanatory";
}

function buildPexelsQueries(context: StrategyContext, mode: VideoMode): string[] {
  const seeds = [
    ...(context.webpageInsight?.keywords ?? []),
    ...(context.intents?.mustIncludePoints ?? []),
    context.webpageInsight?.title ?? "",
    context.webpageInsight?.description ?? "",
  ]
    .map((value) => normalizeSpace(value))
    .filter((value) => value.length >= 4 && value.length <= 60);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    const key = seed.toLowerCase();
    if (seen.has(key)) continue;
    deduped.push(seed);
    seen.add(key);
    if (deduped.length === 3) break;
  }

  if (deduped.length > 0) {
    return deduped;
  }

  if (mode === "hook-ad") {
    return ["modern SaaS dashboard", "startup team shipping fast"];
  }
  if (mode === "product-demo") {
    return ["product workflow close-up", "team analytics workspace", "modern SaaS dashboard"];
  }
  return ["modern SaaS dashboard", "team analytics workspace", "focused office collaboration"];
}

export function planVideoStrategy(context: StrategyContext): VideoStrategy {
  const reasons: string[] = [];
  const mode = inferMode(context, reasons);
  const durationSeconds = inferDurationSeconds(context, mode, reasons);
  const sceneCount = inferSceneCount(durationSeconds, mode);
  const fps = context.fps ?? 30;
  const preferredAssetIds = getPreferredAssetIds(context.intents, context.assets);
  const productAssetCount = context.assets.filter(isProductEvidenceAsset).length;
  const assetMode: AssetPlanMode =
    preferredAssetIds.length >= 2 || productAssetCount >= 3
      ? "product-led"
      : productAssetCount >= 1
        ? "hybrid"
        : "stock-supported";

  return {
    mode,
    targetDurationSeconds: durationSeconds,
    sceneCount,
    targetTotalFrames: durationSeconds * fps,
    pacing: inferPacing(durationSeconds),
    reasons,
    assetPlan: {
      mode: assetMode,
      stockRole: assetMode === "stock-supported" ? "fallback-primary" : "supporting-only",
      productEvidenceRequired: assetMode !== "stock-supported",
      preferredAssetIds,
      recommendedPexelsQueries: buildPexelsQueries(context, mode),
    },
  };
}

function getFallbackAssetId(strategy: VideoStrategy, assets: ProjectAsset[]): string {
  const preferred = strategy.assetPlan.preferredAssetIds[0];
  if (preferred) return preferred;

  const productAsset = assets.find(isProductEvidenceAsset);
  if (productAsset) return productAsset.id;

  return assets[0]?.id ?? "";
}

function shouldBackfillPexelsQuery(
  component: string,
  strategy: VideoStrategy,
  currentQuery: unknown,
): boolean {
  if (typeof currentQuery === "string" && currentQuery.trim().length > 0) {
    return false;
  }

  if (strategy.assetPlan.recommendedPexelsQueries.length === 0) {
    return false;
  }

  return (
    component === "HeroContent" ||
    component === "GenerativeDemo" ||
    component === "FocusShot" ||
    component === "SplitScreen"
  );
}

export function applyStrategicSceneDefaults(
  spec: RenderSpec,
  strategy: VideoStrategy,
  assets: ProjectAsset[],
): RenderSpec {
  const fallbackAssetId = getFallbackAssetId(strategy, assets);
  let queryIndex = 0;

  const scenes = spec.scenes.map((scene) => {
    const params = { ...scene.params };
    const mediaElementId =
      scene.mediaElementId.trim().length > 0 ? scene.mediaElementId : fallbackAssetId;

    if (shouldBackfillPexelsQuery(scene.component, strategy, params.pexelsQuery)) {
      const nextQuery =
        strategy.assetPlan.recommendedPexelsQueries[
          queryIndex % strategy.assetPlan.recommendedPexelsQueries.length
        ];
      if (nextQuery) {
        params.pexelsQuery = nextQuery;
        queryIndex += 1;
      }
    }

    return {
      ...scene,
      mediaElementId,
      params,
    };
  });

  return {
    ...spec,
    scenes,
  };
}
