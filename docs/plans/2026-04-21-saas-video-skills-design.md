# SaaS Video Skills Design

## Goal

Add two repository skills that make SaaSReels video generation both more marketable and safer to run through HyperFrames. `saas-director-engine` guides the creative and RenderSpec authoring process. `script-first-validation` blocks malformed RenderSpecs before enqueueing, materialization, validation, preview, or render.

## Context

The current worker changes show the failure mode clearly: AI-generated specs can drift from the expected schema, assets can be missing, and validation often happens after expensive or stateful work has started. The skills should not replace runtime validation. They should teach future agents the right workflow and provide a deterministic local validator that can be run before render or database enqueue.

## Architecture

Create `skills/saas-director-engine` as a workflow/reference skill. Keep the main `SKILL.md` short and route detailed marketing models and RenderSpec rules into `references/`.

Create `skills/script-first-validation` as a discipline and tooling skill. Include a standalone Node script, `scripts/validate-render-spec.mjs`, that validates JSON purity, schema shape, component allowlists, duration math, and asset references without network access.

## Boundaries

This phase does not fix `packages/saasreels-worker` build failures or integrate the validator into `director.ts` or `runner.ts`. It creates a reliable quality gate that can be wired into the worker in a later phase.

The validator intentionally avoids external dependencies so it can run in the current repo without package churn. It should not connect to Postgres, call AI APIs, fetch Pexels, or render video.

## Success Criteria

- The two skills have valid frontmatter, concise trigger descriptions, and usable workflow instructions.
- The validation skill includes a runnable validator and fixtures.
- A valid RenderSpec fixture exits with code `0`.
- Invalid fixtures exit with code `1` and identify the exact failing fields.
- Skill validation passes with `quick_validate.py`.
- Changed skill files pass `oxfmt --check`.

## Extension: Adaptive Duration And Asset Planning

### Problem

The first skill pass teaches agents how to write a marketing video and how to validate a RenderSpec, but it still leans toward short ad pacing. That is not enough when the job is to explain a landing page or product flow. We also need a clearer rule for when to rely on product assets versus stock footage.

### Design

Add a planning layer inside `packages/saasreels-worker/src/director.ts` that decides three things before prompting the model:

- video mode: `hook-ad`, `landing-page-summary`, or `product-demo`
- adaptive target duration based on intent, page complexity, and explicit duration hints
- asset strategy based on available product assets and whether stock footage should be support-only or a fallback

Expose this planning logic as a small pure module with tests so prompt construction and mock mode can both reuse it.

### Scope For This Iteration

- add a tested strategy module for mode, duration, scene-count, and asset planning
- feed strategy guidance into the director prompt
- use the strategy to backfill missing asset ids and missing `pexelsQuery` hints before validation
- update `saas-director-engine` references so future agents do not assume every SaaS video should be 15 seconds
