import test from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureAsset, prepareWorkspaceAssets } from "./assets.js";

const TMP_DIR = path.resolve(process.cwd(), ".tmp/test-assets");
const CACHE_DIR = path.join(TMP_DIR, "cache");
const WORKSPACE_DIR = path.join(TMP_DIR, "workspace");

test("AssetService", async (t) => {
  // Cleanup before tests
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  await t.test("ensureAsset downloads and caches a file", async () => {
    // Using a reliable sample image URL
    const url = "https://picsum.photos/seed/hyperframes/200/300";
    const cachedPath = await ensureAsset(url, CACHE_DIR);

    assert.ok(cachedPath.includes(CACHE_DIR), "Path should be in cache dir");
    const stats = await fs.stat(cachedPath);
    assert.ok(stats.size > 0, "File should not be empty");

    // Run again to check cache hit
    const cachedPath2 = await ensureAsset(url, CACHE_DIR);
    assert.strictEqual(cachedPath, cachedPath2, "Should return same path on cache hit");
  });

  await t.test("prepareWorkspaceAssets maps assets to workspace", async () => {
    const assetMap = {
      asset_1: "https://picsum.photos/seed/saasreels/150/150",
      asset_2: "https://picsum.photos/seed/worker/100/100",
    };

    await prepareWorkspaceAssets(assetMap, WORKSPACE_DIR, CACHE_DIR);

    const assetsDir = path.join(WORKSPACE_DIR, "assets");
    const files = await fs.readdir(assetsDir);

    // Verify mapped files exist (extension might vary but ID should be there)
    assert.ok(
      files.some((f) => f.startsWith("asset_1")),
      "asset_1 should exist in workspace",
    );
    assert.ok(
      files.some((f) => f.startsWith("asset_2")),
      "asset_2 should exist in workspace",
    );
  });
});
