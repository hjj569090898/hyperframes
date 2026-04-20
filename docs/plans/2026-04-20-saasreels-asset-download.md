# SaaSReels Asset Download Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure all video/image assets are downloaded to a local cache and available in the task workspace before rendering.

**Architecture:** Use an `AssetService` to manage a global cache in `.tmp/saasreels-worker/cache` and link assets to task workspaces.

**Tech Stack:** Node.js (fs, crypto, fetch), TypeScript.

---

### Task 5: Implement AssetService

**Files:**
- Create: `packages/saasreels-worker/src/assets.ts`
- Test: `packages/saasreels-worker/src/assets.test.ts`

**Step 1: Write the failing test**
A test that mocks a download and verifies the file is saved in the cache with a hashed filename.

**Step 2: Implement download logic**
Implement `ensureAsset` and `prepareWorkspaceAssets` functions. 
Use `crypto.createHash('sha256')` for URL hashing.

**Step 3: Run and verify**
`node --import tsx --test packages/saasreels-worker/src/assets.test.ts`

### Task 4: Upgrade Translator for Media

**Files:**
- Modify: `packages/saasreels-worker/src/translate.ts`

**Step 1: Update mapping logic**
Detect if a media element is a video or image (can be based on extension or explicit type in payload).
Generate `<img src="./assets/id.ext">` or `<video src="./assets/id.ext">`.

**Step 2: Add CSS for media**
Ensure media fills the scene correctly (object-fit: cover).

### Task 5: Integration

**Files:**
- Modify: `packages/saasreels-worker/src/runner.ts`

**Step 1: Call assets.ts in runner**
In `runWorkerOnceWithAdapter`, before calling `executeRenderJob`, call `prepareWorkspaceAssets`.

**Step 2: Test with real URL**
Update `mock_task.json` with a real image/video URL (e.g. from Unsplash or a test bucket).
Run the worker and verify the output video contains the real asset.
