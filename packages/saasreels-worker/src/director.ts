import { callAiModel, type AiFetchOptions } from "./ai.js";
import type { ProjectAsset, ProjectIntent } from "./db.js";
import { searchPexelsVideo } from "./pexels.js";
import { parseRenderSpecCandidate, validateRenderSpecOrThrow } from "./renderSpecValidation.js";
import { getWebpageInsight, type PageInsight } from "./scraper.js";
import { applyStrategicSceneDefaults, planVideoStrategy, type VideoStrategy } from "./strategy.js";
import type { RenderScene, RenderSpec } from "./translate.js";

export interface DirectingContext {
  sourceUrl: string;
  templateId: string;
  projectId: string;
  brief?: string;
  targetDurationSeconds?: number;
  intents: ProjectIntent | null;
  assets: ProjectAsset[];
  webpageInsight?: PageInsight;
}

export class CinematicDirector {
  constructor(private aiOptions: AiFetchOptions) {}

  async direct(context: DirectingContext): Promise<RenderSpec> {
    const webpageInsight =
      context.webpageInsight ??
      (context.sourceUrl ? await this.getWebpageInsightSafely(context.sourceUrl) : undefined);
    const contextWithInsight = {
      ...context,
      webpageInsight,
    };
    const strategy = planVideoStrategy(contextWithInsight);

    if (
      !this.aiOptions.apiKey ||
      this.aiOptions.apiKey === "MOCK_KEY" ||
      this.aiOptions.apiKey === ""
    ) {
      console.log("[Director] No API key provided. Running in mock mode...");
      return this.directMock(contextWithInsight, strategy);
    }

    const prompt = this.buildPrompt(contextWithInsight, strategy);
    const imageUrls = context.assets
      .filter((asset) => asset.type === "image")
      .map((asset) => asset.r2Url)
      .slice(0, 5);

    console.log(`[Director] Phase 1/3: Primary creative drafting with ${this.aiOptions.model}...`);
    const draft = await callAiModel(prompt, {
      ...this.aiOptions,
      systemPrompt: this.getSystemPrompt(),
      imageUrls,
    });

    const auditedResult = await this.auditDraftIfConfigured(draft);
    const parsed = parseRenderSpecCandidate(auditedResult || draft, { allowExtract: true });
    if (!parsed.ok) {
      console.error("[Director] Failed to parse AI Director output:", draft);
      throw new Error(`Failed to generate video script:\n${parsed.errors.join("\n")}`);
    }
    for (const warning of parsed.warnings) {
      console.warn(`[Director] ${warning}`);
    }

    const plannedSpec = applyStrategicSceneDefaults(
      parsed.value,
      strategy,
      contextWithInsight.assets,
    );
    const enrichedSpec = await this.enrichWithStockAssets(plannedSpec, contextWithInsight);
    return validateRenderSpecOrThrow(
      this.validateAndFinalizeSpec(enrichedSpec, contextWithInsight),
    );
  }

  private async getWebpageInsightSafely(sourceUrl: string): Promise<PageInsight | undefined> {
    console.log(`[Director] Gathering intel from ${sourceUrl}...`);
    try {
      return await getWebpageInsight(sourceUrl);
    } catch (error) {
      console.warn("[Director] Webpage insight failed; continuing with provided context:", error);
      return undefined;
    }
  }

  private async auditDraftIfConfigured(draft: string): Promise<string> {
    const auditApiKey = process.env.MINIMAX_RELAY_API_KEY;
    const auditBaseUrl = process.env.MINIMAX_RELAY_BASE_URL;
    const auditModel = process.env.MINIMAX_RELAY_MODEL;

    if (!auditApiKey || !auditBaseUrl || !auditModel) {
      return "";
    }

    console.log(`[Director] Phase 2/3: Marketing audit with ${auditModel}...`);
    try {
      return await callAiModel(
        `Review and improve this SaaS video RenderSpec for maximum marketing impact.

Current RenderSpec candidate:
${draft}

Rules:
- Return only valid JSON matching the exact RenderSpec schema.
- Fix type -> component, duration -> durationFrames, and content -> text.content.
- Preserve pexelsQuery and stockVideoId in scene.params.
- Ensure fps, format, totalFrames, scenes, component, mediaElementId, durationFrames, and params are present.
- Ensure totalFrames equals the sum of all scene durationFrames.`,
        {
          apiKey: auditApiKey,
          endpoint: `${auditBaseUrl}/chat/completions`,
          model: auditModel,
          systemPrompt:
            "You are a marketing auditor and strict JSON validator. Return only the final RenderSpec JSON object.",
        },
      );
    } catch (error) {
      console.warn("[Director] Audit phase failed; falling back to draft:", error);
      return "";
    }
  }

  private async enrichWithStockAssets(
    spec: RenderSpec,
    context: DirectingContext,
  ): Promise<RenderSpec> {
    console.log("[Director] Phase 3/3: Enriching with stock assets...");
    for (let index = 0; index < spec.scenes.length; index += 1) {
      const scene = spec.scenes[index];
      if (!scene) continue;

      const query =
        typeof scene.params.pexelsQuery === "string" ? scene.params.pexelsQuery.trim() : "";
      if (!query) continue;

      const videoUrl = await searchPexelsVideo(query);
      if (!videoUrl) continue;

      const pexelsId = `pexels_bg_${index}`;
      scene.params.stockVideoId = pexelsId;
      context.assets.push({
        id: pexelsId,
        type: "video",
        r2Url: videoUrl,
        userDescription: `Stock video for ${query}`,
        intendedRole: "stock_background",
      });
    }
    return spec;
  }

  private getSystemPrompt(): string {
    return `You are an elite Marketing Director and Cinematic Video Producer specializing in high-converting SaaS promotional videos.
Your job is to transform a product landing page into a punchy RenderSpec for a short marketing video.

### SEVEN SOUL ELEMENTS
1. The 3-second hook: open with a pattern interrupt, question, or clear outcome.
2. PAS narrative: Problem -> Agitation -> Solution.
3. Sell benefits, not features: focus on time saved, risk removed, or revenue created.
4. Show, do not just tell: use GenerativeDemo, FocusShot, SplitScreen, or FeatureHighlight.
5. Social proof: include numbers, results, or trust signals when available.
6. Unified CTA: end with one clear next action.
7. Rhythmic pacing: each scene should usually last 2.5 to 5 seconds.

### STRICT OUTPUT SCHEMA
Return only a JSON object matching this shape:
{
  "fps": 30,
  "format": "16:9",
  "totalFrames": 450,
  "scenes": [
    {
      "component": "HeroContent",
      "mediaElementId": "asset_id_from_inventory",
      "durationFrames": 90,
      "text": {
        "content": "A hook that stops the scroll",
        "style": "headline",
        "position": "center"
      },
      "params": {
        "bgGlowColor": "#0a0a0a",
        "transition": "scale_up",
        "pexelsQuery": "modern SaaS team dashboard"
      }
    }
  ],
  "globalAssets": {
    "bgmId": "optional_asset_id",
    "bgmVolume": 0.45
  }
}

### HARD RULES
- Never use type; use component.
- Never use duration; use durationFrames.
- Never put headline copy in scene.content; use scene.text.content.
- mediaElementId must come from the asset inventory when inventory exists.
- totalFrames must equal the sum of all scene durationFrames.
- Return only valid JSON. No markdown, comments, explanations, or code fences.`;
  }

  private buildPrompt(context: DirectingContext, strategy: VideoStrategy): string {
    const { sourceUrl, intents, assets, brief, webpageInsight } = context;
    const insightText = webpageInsight
      ? `
### WEBPAGE INSIGHTS
- Title: ${webpageInsight.title}
- Description: ${webpageInsight.description}
- Marketing keywords: ${webpageInsight.keywords.join(", ")}
`
      : "";
    const preferredAssetText =
      strategy.assetPlan.preferredAssetIds.length > 0
        ? strategy.assetPlan.preferredAssetIds.join(", ")
        : "None provided";
    const pexelsHintText =
      strategy.assetPlan.recommendedPexelsQueries.length > 0
        ? strategy.assetPlan.recommendedPexelsQueries.join(" | ")
        : "Only use stock if the scene truly needs atmosphere";

    return `Direct a high-converting SaaS marketing video for: ${sourceUrl}
${insightText}
${brief ? `Campaign brief: ${brief}` : ""}

### ASSET INVENTORY
${
  assets.length > 0
    ? assets
        .map(
          (asset) =>
            `- ID: ${asset.id}, type: ${asset.type}, role: ${asset.intendedRole || "N/A"}, context: ${asset.userDescription || "N/A"}`,
        )
        .join("\n")
    : "No specific assets were provided. Use empty mediaElementId values and lean on text-driven scenes."
}

### CAMPAIGN INTENTS
- Slogan: "${intents?.slogan || "Infer a sharp slogan from the product"}"
- Must include:
  ${intents?.mustIncludePoints?.join("\n  ") || "Infer the top three selling points from the page and assets."}

### VIDEO STRATEGY
- Mode: ${strategy.mode}
- Target duration: about ${strategy.targetDurationSeconds} seconds
- Target scene count: ${strategy.sceneCount}
- Pacing: ${strategy.pacing}
- Product asset strategy: ${strategy.assetPlan.mode}
- Preferred product assets: ${preferredAssetText}
- Stock footage role: ${strategy.assetPlan.stockRole}
- Suggested stock search hints: ${pexelsHintText}

### PRODUCTION INSTRUCTIONS
1. Scene 1 must be a hook.
2. Middle scenes must reveal pain, amplify it, and show the product solving it.
3. End with a single CTA.
4. Use a mix of HeroContent, GenerativeDemo, FocusShot, FeatureHighlight, SocialProof, and UnifiedCTA.
5. Match the total pacing to the target duration instead of forcing a 15-second ad.
6. Use product evidence first. Use pexelsQuery only when a scene benefits from supporting atmosphere or when product assets are missing.

Return the RenderSpec JSON now.`;
  }

  private validateAndFinalizeSpec(spec: RenderSpec, context: DirectingContext): RenderSpec {
    const finalAssets: Record<string, string> = { ...(spec.assets ?? {}) };
    const validAssetIds = new Set(context.assets.map((asset) => asset.id));
    const firstValidId = context.assets[0]?.id;

    for (const scene of spec.scenes) {
      if (validAssetIds.size > 0 && !validAssetIds.has(scene.mediaElementId)) {
        console.warn(
          `[Director] Hallucinated asset ID detected: ${scene.mediaElementId}. Falling back to ${firstValidId ?? ""}`,
        );
        scene.mediaElementId = firstValidId ?? "";
      }

      const primaryAsset = context.assets.find((asset) => asset.id === scene.mediaElementId);
      if (primaryAsset) {
        finalAssets[primaryAsset.id] = primaryAsset.r2Url;
      }

      const extraAssetIds = [
        scene.params.secondaryMediaId,
        scene.params.stockVideoId,
        ...(Array.isArray(scene.params.otherAssetIds) ? scene.params.otherAssetIds : []),
      ].filter((assetId): assetId is string => typeof assetId === "string");

      for (const extraId of extraAssetIds) {
        const extraAsset = context.assets.find((asset) => asset.id === extraId);
        if (extraAsset) {
          finalAssets[extraAsset.id] = extraAsset.r2Url;
        }
      }
    }

    return {
      ...spec,
      assets: finalAssets,
    };
  }

  public async directMock(
    context: DirectingContext,
    strategy?: VideoStrategy,
  ): Promise<RenderSpec> {
    const resolvedStrategy =
      strategy ??
      planVideoStrategy({
        ...context,
      });
    const imageAssets = context.assets.filter((asset) => asset.type === "image");

    const heroAsset = imageAssets.find((asset) => asset.intendedRole === "hero") || imageAssets[0];
    const featureAsset =
      imageAssets.find((asset) => asset.intendedRole === "feature_explanation") ||
      imageAssets[1] ||
      imageAssets[0];
    const galleryAsset =
      imageAssets.find((asset) => asset.intendedRole === "gallery") ||
      imageAssets[2] ||
      imageAssets[0];
    const proofAsset =
      imageAssets.find((asset) => asset.intendedRole === "social_proof") ||
      imageAssets[3] ||
      imageAssets[0];

    const totalFrames = resolvedStrategy.targetTotalFrames;
    const sceneCount =
      resolvedStrategy.mode === "hook-ad" ? 4 : resolvedStrategy.mode === "product-demo" ? 7 : 6;
    const baseFrames = Math.floor(totalFrames / sceneCount);
    const remainder = totalFrames - baseFrames * sceneCount;
    const durations = Array.from(
      { length: sceneCount },
      (_, index) => baseFrames + (index < remainder ? 1 : 0),
    );
    const stockHints = resolvedStrategy.assetPlan.recommendedPexelsQueries;

    const sceneBlueprints: Omit<RenderScene, "durationFrames">[] =
      resolvedStrategy.mode === "hook-ad"
        ? [
            {
              component: "HeroContent",
              mediaElementId: heroAsset?.id || "",
              text: {
                content: context.intents?.slogan || "Turn one URL into a product hook",
                style: "headline",
                position: "center",
              },
              params: {
                bgGlowColor: "#0a0a0a",
                transition: "scale_up",
                pexelsQuery: stockHints[0],
              },
            },
            {
              component: "GenerativeDemo",
              mediaElementId: featureAsset?.id || "",
              text: {
                content: "Stop stitching scripts, screenshots, and edits by hand",
                style: "subhead",
                position: "bottom",
              },
              params: {
                bgGlowColor: "#111111",
                transition: "slide_left",
                pexelsQuery: stockHints[1],
              },
            },
            {
              component: "FeatureHighlight",
              mediaElementId: featureAsset?.id || "",
              text: {
                content: "Hook first. Brand aligned. Render ready.",
                style: "subhead",
                position: "center",
              },
              params: { bgGlowColor: "#001a33", transition: "fade_in" },
            },
            {
              component: "UnifiedCTA",
              mediaElementId: heroAsset?.id || "",
              text: {
                content: "Create your next product video",
                style: "headline",
                position: "center",
              },
              params: { bgGlowColor: "#000000", transition: "scale_up" },
            },
          ]
        : resolvedStrategy.mode === "product-demo"
          ? [
              {
                component: "HeroContent",
                mediaElementId: heroAsset?.id || "",
                text: {
                  content: context.intents?.slogan || "See the workflow before you buy",
                  style: "headline",
                  position: "center",
                },
                params: {
                  bgGlowColor: "#0a0a0a",
                  transition: "scale_up",
                  pexelsQuery: stockHints[0],
                },
              },
              {
                component: "GenerativeDemo",
                mediaElementId: featureAsset?.id || "",
                text: {
                  content: "Show the setup and first win in one flow",
                  style: "subhead",
                  position: "bottom",
                },
                params: { bgGlowColor: "#111111", transition: "slide_left" },
              },
              {
                component: "FocusShot",
                mediaElementId: galleryAsset?.id || "",
                text: {
                  content: "Make the core workflow easy to follow",
                  style: "subhead",
                  position: "center",
                },
                params: { bgGlowColor: "#08111f", transition: "flip_center" },
              },
              {
                component: "FeatureHighlight",
                mediaElementId: featureAsset?.id || "",
                text: {
                  content: "Translate features into time saved and risk removed",
                  style: "subhead",
                  position: "center",
                },
                params: { bgGlowColor: "#001a33", transition: "fade_in" },
              },
              {
                component: "GenerativeDemo",
                mediaElementId: galleryAsset?.id || "",
                text: {
                  content: "Keep product evidence on screen while the story advances",
                  style: "subhead",
                  position: "bottom",
                },
                params: {
                  bgGlowColor: "#0b1020",
                  transition: "slide_right",
                  pexelsQuery: stockHints[1],
                },
              },
              {
                component: "SocialProof",
                mediaElementId: proofAsset?.id || "",
                text: {
                  content: "Back the promise with proof and specifics",
                  style: "subhead",
                  position: "center",
                },
                params: { bgGlowColor: "#111111", transition: "scale_up" },
              },
              {
                component: "UnifiedCTA",
                mediaElementId: heroAsset?.id || "",
                text: {
                  content: "Watch your product explain itself",
                  style: "headline",
                  position: "center",
                },
                params: { bgGlowColor: "#000000", transition: "scale_up" },
              },
            ]
          : [
              {
                component: "HeroContent",
                mediaElementId: heroAsset?.id || "",
                text: {
                  content: context.intents?.slogan || "Turn one URL into a launch video",
                  style: "headline",
                  position: "center",
                },
                params: {
                  bgGlowColor: "#0a0a0a",
                  transition: "scale_up",
                  pexelsQuery: stockHints[0],
                },
              },
              {
                component: "GenerativeDemo",
                mediaElementId: featureAsset?.id || "",
                text: {
                  content: "Stop stitching scripts, screenshots, and edits by hand",
                  style: "subhead",
                  position: "bottom",
                },
                params: { bgGlowColor: "#111111", transition: "slide_left" },
              },
              {
                component: "FeatureHighlight",
                mediaElementId: featureAsset?.id || "",
                text: {
                  content: "Hook first. Brand aligned. Render ready.",
                  style: "subhead",
                  position: "center",
                },
                params: { bgGlowColor: "#001a33", transition: "fade_in" },
              },
              {
                component: "FocusShot",
                mediaElementId: galleryAsset?.id || "",
                text: {
                  content: "Validate every scene before render spend begins",
                  style: "subhead",
                  position: "center",
                },
                params: {
                  bgGlowColor: "#111111",
                  transition: "flip_center",
                  pexelsQuery: stockHints[1],
                },
              },
              {
                component: "SocialProof",
                mediaElementId: proofAsset?.id || "",
                text: {
                  content: "Built for repeatable campaign output",
                  style: "subhead",
                  position: "center",
                },
                params: { bgGlowColor: "#111111", transition: "scale_up" },
              },
              {
                component: "UnifiedCTA",
                mediaElementId: heroAsset?.id || "",
                text: {
                  content: "Create your next product video",
                  style: "headline",
                  position: "center",
                },
                params: { bgGlowColor: "#000000", transition: "scale_up" },
              },
            ];

    const scenes: RenderScene[] = sceneBlueprints.map((scene, index) => ({
      ...scene,
      durationFrames: durations[index] ?? baseFrames,
    }));

    return validateRenderSpecOrThrow(
      this.validateAndFinalizeSpec(
        {
          fps: 30,
          format: "16:9",
          totalFrames: scenes.reduce((sum, scene) => sum + scene.durationFrames, 0),
          scenes,
          assets: {},
          globalAssets: {
            bgmVolume: 0,
          },
        },
        context,
      ),
    );
  }
}
