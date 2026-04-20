# SaaSReels MVP Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a functional rendering pipeline that converts SaaSReels RenderSpec JSON into MP4 video using HyperFrames.

**Architecture:** Use a `SaasReelsTranslator` to generate static HTML compositions and `@hyperframes/producer` to capture them into video.

**Tech Stack:** TypeScript, Bun, GSAP (runtime), @hyperframes/producer.

---

### Task 1: Create the Translator Core

**Files:**
- Create: `packages/saasreels-worker/src/translate.ts`
- Modify: `packages/saasreels-worker/src/index.ts`
- Test: `packages/saasreels-worker/src/translate.test.ts`

**Step 1: Write the failing test**
Create a test that expects a RenderSpec to be converted into an HTML string containing `data-composition-id`.

**Step 2: Run test to verify it fails**
Run: `bun test packages/saasreels-worker/src/translate.test.ts`

**Step 3: Write minimal implementation**
Implement `translateRenderSpecToHtml` function.

**Step 4: Run test to verify it passes**
Run: `bun test packages/saasreels-worker/src/translate.test.ts`

**Step 5: Commit**
`git add packages/saasreels-worker/src/translate.ts`
`git commit -m "feat: add saasreels translator core"`

### Task 2: Implement Component Visuals (Mock UI)

**Files:**
- Modify: `packages/saasreels-worker/src/translate.ts`

**Step 1: Add CSS generation**
Add basic styles for `FocusShot` and `GenerativeDemo` (e.g., card shadows, center alignment).

**Step 2: Add GSAP registration**
Ensure the generated HTML includes the GSAP timeline registration script.

**Step 3: Commit**
`git commit -am "feat: add basic visuals and gsap timelines to translator"`

### Task 3: Integrate Producer in Worker Runner

**Files:**
- Modify: `packages/saasreels-worker/src/worker.ts`
- Modify: `packages/saasreels-worker/src/runner.ts`

**Step 1: Update materialize logic**
Make `materializeDryRunWorkspace` actually write the translated `index.html`.

**Step 2: Add render step**
Modify `runWorkerOnceWithAdapter` to call `executeRenderJob` from `@hyperframes/producer` after materialization.

**Step 3: Test with mock task**
Execute a `run-once` command with a manual JSON.

**Step 4: Commit**
`git commit -am "feat: integrate hyperframes producer into worker execution"`
