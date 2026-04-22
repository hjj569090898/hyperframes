import test from "node:test";
import assert from "node:assert/strict";

import { applyStrategicSceneDefaults, planVideoStrategy, type VideoStrategy } from "./strategy.js";
import type { ProjectAsset, ProjectIntent } from "./db.js";
import type { RenderSpec } from "./translate.js";

const defaultIntents: ProjectIntent = {
  slogan: "Ship polished product videos from one URL",
  mustIncludePoints: ["Explain the workflow clearly", "Show the dashboard", "End with one CTA"],
  preferredAssetIds: ["hero-ui", "proof-ui"],
};

const defaultAssets: ProjectAsset[] = [
  {
    id: "hero-ui",
    type: "image",
    r2Url: "https://cdn.example.com/hero-ui.png",
    userDescription: "Main product dashboard hero",
    intendedRole: "hero",
  },
  {
    id: "proof-ui",
    type: "image",
    r2Url: "https://cdn.example.com/proof-ui.png",
    userDescription: "Metrics and proof section screenshot",
    intendedRole: "social_proof",
  },
  {
    id: "demo-ui",
    type: "video",
    r2Url: "https://cdn.example.com/demo-ui.mp4",
    userDescription: "Guided product workflow demo",
    intendedRole: "feature_explanation",
  },
];

test("planVideoStrategy defaults source pages to landing-page-summary with adaptive duration", () => {
  const strategy = planVideoStrategy({
    sourceUrl: "https://example.com",
    brief: "Turn this landing page into a crisp SaaS marketing video.",
    intents: defaultIntents,
    assets: defaultAssets,
    webpageInsight: {
      title: "Acme CRM",
      description: "Pipeline automation for lean sales teams.",
      keywords: ["sales dashboard", "pipeline automation", "team analytics", "faster follow-up"],
    },
  });

  assert.equal(strategy.mode, "landing-page-summary");
  assert.equal(strategy.assetPlan.mode, "product-led");
  assert.equal(strategy.assetPlan.stockRole, "supporting-only");
  assert.ok(strategy.targetDurationSeconds >= 20);
  assert.ok(strategy.targetDurationSeconds <= 35);
  assert.ok(strategy.sceneCount >= 5);
  assert.ok(strategy.sceneCount <= 7);
  assert.deepEqual(strategy.assetPlan.preferredAssetIds.slice(0, 2), ["hero-ui", "proof-ui"]);
});

test("planVideoStrategy stretches into product-demo when the brief asks for walkthrough pacing", () => {
  const strategy = planVideoStrategy({
    sourceUrl: "https://example.com/demo",
    brief:
      "Create a walkthrough demo that explains the onboarding flow, day-one setup, and how teams review analytics step by step.",
    intents: {
      ...defaultIntents,
      mustIncludePoints: [
        "Show onboarding",
        "Show automation rules",
        "Show analytics review",
        "Explain who it is for",
        "Finish with a CTA",
      ],
    },
    assets: defaultAssets,
    webpageInsight: {
      title: "Acme CRM Demo",
      description: "Watch the full workflow from signup to pipeline review.",
      keywords: ["onboarding", "workflow", "analytics", "team handoff"],
    },
  });

  assert.equal(strategy.mode, "product-demo");
  assert.ok(strategy.targetDurationSeconds >= 30);
  assert.ok(strategy.targetDurationSeconds <= 50);
  assert.ok(strategy.sceneCount >= 6);
  assert.equal(strategy.assetPlan.mode, "product-led");
});

test("applyStrategicSceneDefaults backfills missing asset ids and stock query hints", () => {
  const strategy: VideoStrategy = {
    mode: "landing-page-summary",
    targetDurationSeconds: 28,
    sceneCount: 6,
    targetTotalFrames: 840,
    pacing: "balanced",
    reasons: ["default sourceUrl strategy"],
    assetPlan: {
      mode: "hybrid",
      stockRole: "supporting-only",
      productEvidenceRequired: true,
      preferredAssetIds: ["hero-ui"],
      recommendedPexelsQueries: ["modern SaaS dashboard", "team analytics workspace"],
    },
  };

  const spec: RenderSpec = {
    fps: 30,
    format: "16:9",
    totalFrames: 180,
    scenes: [
      {
        component: "HeroContent",
        mediaElementId: "",
        durationFrames: 90,
        text: {
          content: "Stop stitching product videos by hand",
          style: "headline",
          position: "center",
        },
        params: {},
      },
      {
        component: "GenerativeDemo",
        mediaElementId: "",
        durationFrames: 90,
        text: {
          content: "Show the workflow without losing the story",
          style: "subhead",
          position: "bottom",
        },
        params: {},
      },
    ],
    assets: {},
  };

  const nextSpec = applyStrategicSceneDefaults(spec, strategy, defaultAssets);

  assert.equal(nextSpec.scenes[0]?.mediaElementId, "hero-ui");
  assert.equal(nextSpec.scenes[0]?.params.pexelsQuery, "modern SaaS dashboard");
  assert.equal(nextSpec.scenes[1]?.mediaElementId, "hero-ui");
  assert.equal(nextSpec.scenes[1]?.params.pexelsQuery, "team analytics workspace");
});
