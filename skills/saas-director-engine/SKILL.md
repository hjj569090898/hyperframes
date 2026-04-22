---
name: saas-director-engine
description: Use when generating, reviewing, or repairing SaaSReels marketing video RenderSpecs, especially for SaaS promo videos, landing-page-to-video scripts, product launch ads, hook/PAS story arcs, CTAs, and high-converting short-form campaigns.
---

# SaaS Director Engine

## Overview

Create SaaSReels RenderSpecs that are marketing-first and schema-safe. Treat the AI as a director: identify the audience, choose a hook, build a persuasion arc, then emit pure RenderSpec JSON that can pass script-first validation.

## Workflow

1. Read the campaign inputs: source URL, brief, slogan, must-include points, target duration when provided, format, and asset inventory.
2. Decide the video mode and target duration with [duration-strategy.md](references/duration-strategy.md) before writing scenes.
3. Name the viewer, pain, desired outcome, and one-sentence promise before writing scenes.
4. Choose one hook model from [hooks.md](references/hooks.md). The first 3 seconds must earn attention.
5. Build the arc with the seven soul elements from [seven-soul-elements.md](references/seven-soul-elements.md).
6. Plan product assets versus stock support with [asset-strategy.md](references/asset-strategy.md).
7. Emit only the RenderSpec shape described in [render-spec-contract.md](references/render-spec-contract.md).
8. Run `script-first-validation` before enqueueing, materializing, previewing, or rendering.

## Beat Defaults

| Beat     | Purpose                                    | Preferred Component                 | Duration      |
| -------- | ------------------------------------------ | ----------------------------------- | ------------- |
| Hook     | Stop the scroll with tension or result     | `HeroContent`                       | 75-90 frames  |
| Pain     | Make the cost of inaction concrete         | `GenerativeDemo` or `SplitScreen`   | 75-120 frames |
| Solution | Show the product creating the outcome      | `GenerativeDemo` or `FocusShot`     | 90-150 frames |
| Proof    | Add trust, metric, customer, or comparison | `SocialProof` or `FeatureHighlight` | 75-120 frames |
| CTA      | One clear next step                        | `UnifiedCTA` or `HeroContent`       | 75-120 frames |

These are per-beat defaults, not a universal total video length. A 15-second hook ad and a 32-second landing-page summary can use the same beat library with different scene counts and pacing.

## Hard Rules

- Return pure JSON only. No Markdown fences, prefaces, apologies, or commentary.
- Use `component`, not `type`; `durationFrames`, not `duration`; `text.content`, not `scene.content`.
- Use only asset IDs from the provided inventory. Do not invent `mediaElementId` values.
- Keep each scene between 75 and 150 frames unless the brief explicitly asks for a slower explainer.
- Make `totalFrames` equal the sum of all scene `durationFrames`.
- Preserve user-provided slogans and must-include points exactly unless the user asks for rewriting.
- End with one CTA. Do not split attention across multiple calls to action.
- Do not default every source page to 15 seconds. If the goal is to explain a landing page, product flow, or multi-section homepage, prefer adaptive durations from `20-35s` unless the user explicitly asks for a shorter cut.
- Use stock footage only as support or fallback. Product evidence should carry the solution and proof beats whenever product assets exist.

## Quality Bar

Before handing off a RenderSpec, score it quickly:

| Check     | Pass Condition                                                                              |
| --------- | ------------------------------------------------------------------------------------------- |
| Hook      | A viewer knows why to keep watching within 3 seconds                                        |
| Pain      | The script names a specific cost, friction, or missed opportunity                           |
| Benefit   | Each feature line translates into time saved, money earned, risk reduced, or clarity gained |
| Asset Fit | Scenes use product screenshots or UI assets where they create evidence                      |
| Proof     | Metrics, audience, customers, or trust markers appear when available                        |
| CTA       | Final scene has one low-friction next action                                                |
| Schema    | It passes `script-first-validation`                                                         |

If any check fails, revise before enqueueing.

## Common Mistakes

- Writing a feature list instead of a story arc. Convert features into viewer outcomes.
- Letting stock footage replace product evidence. Use B-roll only for atmosphere or transitions.
- Making the opening scene a logo reveal. Start with tension, result, or contrast.
- Treating target duration as fixed when the brief is actually about explanation depth. Pick the duration after choosing the mode.
- Producing beautiful copy with invalid fields. Schema validity is part of directing.
- Relying on the renderer to discover problems. Validate the script first.

## References

- [hooks.md](references/hooks.md) - Hook patterns and selection rules.
- [duration-strategy.md](references/duration-strategy.md) - How to choose 15s, 20-35s, or 30-50s pacing.
- [asset-strategy.md](references/asset-strategy.md) - Product evidence first, stock as support, Pexels query guidance.
- [seven-soul-elements.md](references/seven-soul-elements.md) - Marketing checklist and rubric.
- [render-spec-contract.md](references/render-spec-contract.md) - Required RenderSpec shape.
- [examples.md](references/examples.md) - Minimal valid example.
