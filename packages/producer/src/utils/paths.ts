/**
 * Path resolution utilities for the render pipeline.
 */

import { resolve, basename, join } from "node:path";

export interface RenderPaths {
  absoluteProjectDir: string;
  absoluteOutputPath: string;
}

const DEFAULT_RENDERS_DIR =
  process.env.PRODUCER_RENDERS_DIR ??
  resolve(new URL(import.meta.url).pathname, "../../..", "renders");

/**
 * Cross-platform containment check.
 *
 * `child.startsWith(parent + "/")` breaks on Windows because the path
 * separator is `\`, not `/`. This helper uses `path.relative()` which
 * normalises separators per-platform and returns `..`-prefixed output
 * for out-of-tree paths — the canonical way to ask "is `child` inside
 * `parent`?" on every supported OS.
 *
 * Both inputs are normalised via `resolve()` so callers don't need to.
 * Equality counts as "inside" (a directory contains itself).
 */
export function isPathInside(childPath: string, parentPath: string): boolean {
  try {
    const absChild = resolve(childPath).toLowerCase().replace(/\\/g, "/");
    const absParent = resolve(parentPath).toLowerCase().replace(/\\/g, "/");

    if (absChild === absParent) return true;

    const parentWithSlash = absParent.endsWith("/") ? absParent : absParent + "/";
    return absChild.startsWith(parentWithSlash);
  } catch {
    return false;
  }
}

/**
 * Build a safe, cross-platform relative key for an absolute asset path
 * that lives outside the project directory.
 */
export function toExternalAssetKey(absPath: string): string {
  if (absPath.startsWith("hf-ext/")) return absPath;

  // Extremely aggressive normalization for Windows
  let normalised = resolve(absPath).replace(/\\/g, "/");

  // Strip a leading drive-letter colon (Windows: "D:/coder" → "D/coder").
  normalised = normalised.replace(/^([A-Za-z]):\/?/, "$1/");

  // Clean up any remaining double slashes
  normalised = normalised.replace(/\/+/g, "/").replace(/^\/+/, "");

  return "hf-ext/" + normalised;
}

export function resolveRenderPaths(
  projectDir: string,
  outputPath: string | null | undefined,
  rendersDir: string = DEFAULT_RENDERS_DIR,
): RenderPaths {
  const absoluteProjectDir = resolve(projectDir);
  const projectName = basename(absoluteProjectDir);
  const resolvedOutputPath = outputPath ?? join(rendersDir, `${projectName}.mp4`);
  const absoluteOutputPath = resolve(resolvedOutputPath);

  return { absoluteProjectDir, absoluteOutputPath };
}
