import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/**
 * Downloads a URL if not in cache (uses sha256 of URL as filename).
 */
export async function ensureAsset(url: string, cacheDir: string): Promise<string> {
  await fs.mkdir(cacheDir, { recursive: true });

  const hash = crypto.createHash("sha256").update(url).digest("hex");
  const extension = path.extname(new URL(url).pathname) || "";
  const cacheFileName = `${hash}${extension}`;
  const cachePath = path.join(cacheDir, cacheFileName);

  try {
    await fs.access(cachePath);
    return cachePath;
  } catch {
    // Not in cache, download/copy it
    if (url.startsWith("file://")) {
      const filePath = url.slice(7).replace(/^\/([A-Za-z]:)/, "$1"); // Fix Windows drive letter if needed
      await fs.copyFile(filePath, cachePath);
      return cachePath;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download asset: ${response.statusText}`);

    const fileStream = createWriteStream(cachePath);
    // Since we are in Node/Bun environment, we use response.body
    // @ts-ignore - response.body is a ReadableStream in some environments
    await pipeline(response.body, fileStream);

    return cachePath;
  }
}

/**
 * Prepares workspace assets by downloading and mapping them.
 */
export async function prepareWorkspaceAssets(
  assetMap: Record<string, string>,
  workspaceDir: string,
  cacheDir: string,
): Promise<void> {
  if (!assetMap || Object.keys(assetMap).length === 0) return;

  const tasks = Object.entries(assetMap).map(async ([mediaElementId, url]) => {
    const cachedPath = await ensureAsset(url, cacheDir);
    const extension = path.extname(cachedPath);
    const targetPath = path.join(workspaceDir, `${mediaElementId}${extension}`);

    // Copy to workspace root for maximum compatibility
    await fs.copyFile(cachedPath, targetPath);
  });

  await Promise.all(tasks);
}
