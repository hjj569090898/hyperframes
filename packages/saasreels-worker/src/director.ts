import { callAiModel, type AiFetchOptions } from "./ai.js";
import type { ProjectAsset, ProjectIntent } from "./db.js";
import type { RenderSpec } from "./translate.js";

export interface DirectingContext {
  sourceUrl: string;
  templateId: string;
  projectId: string;
  brief?: string;
  intents: ProjectIntent | null;
  assets: ProjectAsset[];
}

export class CinematicDirector {
  constructor(private aiOptions: AiFetchOptions) {}

  async direct(context: DirectingContext): Promise<RenderSpec> {
    if (
      !this.aiOptions.apiKey ||
      this.aiOptions.apiKey === "MOCK_KEY" ||
      this.aiOptions.apiKey === ""
    ) {
      console.log("[Director] No API Key provided. Running in MOCK mode...");
      return this.directMock(context);
    }

    const prompt = this.buildPrompt(context);
    const result = await callAiModel(prompt, {
      ...this.aiOptions,
      systemPrompt: this.getSystemPrompt(),
    });

    try {
      const spec = JSON.parse(result) as RenderSpec;
      return this.validateAndFinalizeSpec(spec, context);
    } catch (e) {
      console.error("Failed to parse AI Director output:", result);
      throw new Error(
        `Failed to generate video script: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private getSystemPrompt(): string {
    return `You are an elite Cinematic Video Director for SaaSReels. 
Your task is to transform a SaaS product's landing page and user intents into a high-converting, cinematic 15-60s video script (RenderSpec).

### CORE PRINCIPLES
1. **Show, Don't Just Tell**: Use the product's visual assets to demonstrate value.
2. **Branding Integrity**: If a Slogan is provided, it MUST be featured prominently (usually at the start or end).
3. **Narrative Flow**: Hook -> Pain -> Solution -> Social Proof/CTA.
4. **Visual Variety**: Alternate between FullScreen, GenerativeDemo (mockups), and SplitScreen.

### CONSTRAINTS
- Return ONLY a valid JSON object matching the RenderSpec schema.
- The video should be energetic and professional.
- Use 'headline' for big impact, 'subhead' for context, 'caption' for feature details.
- Total duration should be around 15-30 seconds unless specified otherwise.
- Ensure all 'mediaElementId' values correspond to the provided project assets or are descriptive placeholders if no asset matches perfectly.

### MANDATORY INSTRUCTIONS
- If the user provides a SLOGAN, use it EXACTLY in a 'headline' overlay.
- If the user provides 'mustIncludePoints', ensure each point is mentioned in at least one scene's text overlay.
- Use provided user assets (Project Assets) wherever possible. Each asset has an 'id' which should be used as 'mediaElementId'.`;
  }

  private buildPrompt(context: DirectingContext): string {
    const { sourceUrl, templateId, intents, assets, brief } = context;

    let prompt = `Direct a video for the following SaaS product:
URL: ${sourceUrl}
Template: ${templateId}
${brief ? `Context: ${brief}\n` : ""}

### USER INTENTS (STRICT ENFORCEMENT)
${intents?.slogan ? `- MANDATORY SLOGAN: "${intents.slogan}"` : "- Use a catchy slogan based on the URL."}
${intents?.mustIncludePoints ? `- MUST INCLUDE THESE POINTS: \n  * ${intents.mustIncludePoints.join("\n  * ")}` : ""}

### AVAILABLE ASSETS
${assets.length > 0 ? assets.map((a) => `- ID: ${a.id}, Type: ${a.type}, Description: ${a.userDescription || "N/A"}, Role: ${a.intendedRole || "N/A"}`).join("\n") : "No specific assets provided. Use catchy placeholders like 'hero-screenshot', 'feature-1-ui'."}

### OUTPUT SCHEMA
Generate a JSON object:
{
  "fps": 30,
  "format": "16:9",
  "totalFrames": 900, 
  "scenes": [
    {
      "durationFrames": 90,
      "component": "HeroContent",
      "mediaElementId": "asset-id-or-placeholder",
      "text": { "content": "The Slogan", "style": "headline", "position": "center" },
      "params": { "bgGlowColor": "#000000" }
    }
  ],
  "assets": {
     "asset-id-or-placeholder": "remote-url-if-not-provided-in-db"
  }
}
`;
    return prompt;
  }

  private validateAndFinalizeSpec(spec: RenderSpec, context: DirectingContext): RenderSpec {
    // 1. Ensure assets from DB are mapped into the spec's assets if used
    const finalAssets: Record<string, string> = { ...spec.assets };

    for (const scene of spec.scenes) {
      const dbAsset = context.assets.find((a) => a.id === scene.mediaElementId);
      if (dbAsset) {
        finalAssets[dbAsset.id] = dbAsset.r2Url;
      }
    }

    // 2. Add missing assets from DB if they were requested as 'preferred' but not used by AI?
    // (Optional logic here)

    return {
      ...spec,
      assets: finalAssets,
    };
  }

  private directMock(context: DirectingContext): RenderSpec {
    const { intents, assets, sourceUrl } = context;
    const slogan = intents?.slogan || `AI Video for ${sourceUrl}`;
    const points = intents?.mustIncludePoints || [
      "Automated Creation",
      "High Quality",
      "Fast Delivery",
    ];

    const scenes: RenderSpec["scenes"] = [
      {
        durationFrames: 90,
        component: "HeroContent",
        mediaElementId: assets[0]?.id || "mock-hero",
        text: { content: slogan, style: "headline", position: "center" },
        params: { bgGlowColor: "#000000" },
      },
      ...points.map((point, i) => ({
        durationFrames: 120,
        component: "GenerativeDemo",
        mediaElementId: assets[i + 1]?.id || assets[0]?.id || "mock-feature",
        text: { content: point, style: "subhead", position: "bottom" },
        params: { bgGlowColor: "#111111" },
      })),
      {
        durationFrames: 90,
        component: "HeroContent",
        mediaElementId: assets[0]?.id || "mock-cta",
        text: { content: "Start Today", style: "headline", position: "center" },
        params: { bgGlowColor: "#222222" },
      },
    ];

    const spec: RenderSpec = {
      fps: 30,
      format: "16:9",
      totalFrames: scenes.reduce((sum, s) => sum + s.durationFrames, 0),
      scenes,
      assets: {},
    };

    return this.validateAndFinalizeSpec(spec, context);
  }
}
