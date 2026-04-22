import type { RenderScene, RenderSpec } from "./translate.js";

export type RenderSpecValidationReport =
  | {
      ok: true;
      errors: [];
      warnings: string[];
      value: RenderSpec;
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
      value?: undefined;
    };

export type ParseRenderSpecCandidateOptions = {
  allowExtract?: boolean;
};

export type ParseRenderSpecCandidateResult =
  | {
      ok: true;
      errors: [];
      warnings: string[];
      value: RenderSpec;
    }
  | {
      ok: false;
      errors: string[];
      warnings: string[];
      value?: undefined;
    };

const VALID_FPS = new Set([30, 60]);
const VALID_FORMATS = new Set(["9:16", "16:9", "1:1"]);
const VALID_TEXT_POSITIONS = new Set(["top", "center", "bottom"]);
const VALID_TEXT_STYLES = new Set(["headline", "subhead", "caption"]);
const TEXT_STYLE_ALIASES = new Map<string, "headline" | "subhead" | "caption">([
  ["subheadline", "subhead"],
  ["subtitle", "subhead"],
  ["body", "caption"],
  ["cta", "headline"],
  ["call_to_action", "headline"],
  ["call-to-action", "headline"],
  ["title", "headline"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function startsAsJsonObject(source: string): boolean {
  return source.startsWith("{") && source.endsWith("}");
}

function extractFirstJsonObject(source: string): string | null {
  const start = source.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function normalizeTextStyle(style: string): "headline" | "subhead" | "caption" | null {
  const normalized = style.trim().toLowerCase();
  if (VALID_TEXT_STYLES.has(normalized)) {
    return normalized as "headline" | "subhead" | "caption";
  }
  return TEXT_STYLE_ALIASES.get(normalized) ?? null;
}

function normalizeRenderSpecCandidate(
  candidate: unknown,
  warnings: string[],
): Record<string, unknown> | unknown {
  if (!isRecord(candidate) || !Array.isArray(candidate.scenes)) {
    return candidate;
  }

  let changed = false;
  const normalizedScenes = candidate.scenes.map((scene, index) => {
    if (!isRecord(scene) || !isRecord(scene.text) || typeof scene.text.style !== "string") {
      return scene;
    }

    const normalizedStyle = normalizeTextStyle(scene.text.style);
    if (!normalizedStyle || normalizedStyle === scene.text.style) {
      return scene;
    }

    changed = true;
    warnings.push(
      `Normalized scenes[${index}].text.style from ${scene.text.style} to ${normalizedStyle}`,
    );
    return {
      ...scene,
      text: {
        ...scene.text,
        style: normalizedStyle,
      },
    };
  });

  if (!changed) {
    return candidate;
  }

  return {
    ...candidate,
    scenes: normalizedScenes,
  };
}

function isRenderScene(value: unknown): value is RenderScene {
  if (!isRecord(value)) return false;
  if (!isPositiveInteger(value.durationFrames)) return false;
  if (typeof value.component !== "string" || value.component.trim().length === 0) return false;
  if (typeof value.mediaElementId !== "string") return false;
  if (!isRecord(value.params)) return false;
  if (value.text !== undefined) {
    if (!isRecord(value.text)) return false;
    if (typeof value.text.content !== "string") return false;
    if (!VALID_TEXT_STYLES.has(String(value.text.style))) return false;
    if (!VALID_TEXT_POSITIONS.has(String(value.text.position))) return false;
  }
  if (value.narration !== undefined) {
    if (!isRecord(value.narration)) return false;
    if (typeof value.narration.audioId !== "string") return false;
    if (value.narration.duration !== undefined && typeof value.narration.duration !== "number") {
      return false;
    }
  }
  return true;
}

function isRenderSpec(value: unknown): value is RenderSpec {
  if (!isRecord(value)) return false;
  if (!VALID_FPS.has(Number(value.fps))) return false;
  if (!VALID_FORMATS.has(String(value.format))) return false;
  if (!isPositiveInteger(value.totalFrames)) return false;
  if (!Array.isArray(value.scenes)) return false;
  if (!value.scenes.every(isRenderScene)) return false;
  if (value.assets !== undefined) {
    if (!isRecord(value.assets)) return false;
    if (!Object.values(value.assets).every((assetUrl) => typeof assetUrl === "string")) {
      return false;
    }
  }
  if (value.globalAssets !== undefined) {
    if (!isRecord(value.globalAssets)) return false;
    if (value.globalAssets.bgmId !== undefined && typeof value.globalAssets.bgmId !== "string") {
      return false;
    }
    if (
      value.globalAssets.bgmVolume !== undefined &&
      typeof value.globalAssets.bgmVolume !== "number"
    ) {
      return false;
    }
  }
  return true;
}

function validateScene(scene: unknown, index: number, errors: string[]): number | null {
  const prefix = `scenes[${index}]`;

  if (!isRecord(scene)) {
    errors.push(`${prefix} must be an object`);
    return null;
  }

  if ("type" in scene) {
    errors.push(`${prefix}.scene.type is not allowed; use component`);
  }
  if ("duration" in scene) {
    errors.push(`${prefix}.scene.duration is not allowed; use durationFrames`);
  }
  if ("content" in scene) {
    errors.push(`${prefix}.scene.content is not allowed; use text.content`);
  }

  if (typeof scene.component !== "string" || scene.component.trim().length === 0) {
    errors.push(`${prefix}.component must be a non-empty string`);
  }
  if (typeof scene.mediaElementId !== "string") {
    errors.push(`${prefix}.mediaElementId must be a string`);
  }
  if (!isPositiveInteger(scene.durationFrames)) {
    errors.push(`${prefix}.durationFrames must be a positive integer`);
  }
  if (!isRecord(scene.params)) {
    errors.push(`${prefix}.params must be an object`);
  }

  if (scene.text !== undefined) {
    if (!isRecord(scene.text)) {
      errors.push(`${prefix}.text must be an object`);
    } else {
      if (typeof scene.text.content !== "string" || scene.text.content.trim().length === 0) {
        errors.push(`${prefix}.text.content must be a non-empty string`);
      }
      if (!VALID_TEXT_STYLES.has(String(scene.text.style))) {
        errors.push(`${prefix}.text.style must be one of headline, subhead, caption`);
      }
      if (!VALID_TEXT_POSITIONS.has(String(scene.text.position))) {
        errors.push(`${prefix}.text.position must be one of top, center, bottom`);
      }
    }
  }

  if (scene.narration !== undefined) {
    if (!isRecord(scene.narration)) {
      errors.push(`${prefix}.narration must be an object`);
    } else {
      if (typeof scene.narration.audioId !== "string") {
        errors.push(`${prefix}.narration.audioId must be a string`);
      }
      if (
        scene.narration.duration !== undefined &&
        (typeof scene.narration.duration !== "number" || scene.narration.duration <= 0)
      ) {
        errors.push(`${prefix}.narration.duration must be a positive number when provided`);
      }
    }
  }

  return isPositiveInteger(scene.durationFrames) ? scene.durationFrames : null;
}

export function validateRenderSpec(candidate: unknown): RenderSpecValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(candidate)) {
    return {
      ok: false,
      errors: ["RenderSpec must be a JSON object"],
      warnings,
    };
  }

  if (!VALID_FPS.has(Number(candidate.fps))) {
    errors.push("fps must be 30 or 60");
  }
  if (!VALID_FORMATS.has(String(candidate.format))) {
    errors.push("format must be one of 9:16, 16:9, 1:1");
  }
  if (!isPositiveInteger(candidate.totalFrames)) {
    errors.push("totalFrames must be a positive integer");
  }
  if (!Array.isArray(candidate.scenes)) {
    errors.push("scenes must be an array");
  }

  let durationSum = 0;
  let hasInvalidDuration = false;
  if (Array.isArray(candidate.scenes)) {
    if (candidate.scenes.length === 0) {
      errors.push("scenes must contain at least one scene");
    }

    candidate.scenes.forEach((scene, index) => {
      const duration = validateScene(scene, index, errors);
      if (duration === null) {
        hasInvalidDuration = true;
      } else {
        durationSum += duration;
      }
    });
  }

  if (isPositiveInteger(candidate.totalFrames)) {
    if (hasInvalidDuration) {
      errors.push(
        "totalFrames cannot be verified because one or more scenes have invalid durationFrames",
      );
    } else if (Array.isArray(candidate.scenes) && durationSum !== candidate.totalFrames) {
      errors.push(`totalFrames must equal the sum of scene durationFrames (${durationSum})`);
    }
  }

  if (candidate.assets !== undefined) {
    if (!isRecord(candidate.assets)) {
      errors.push("assets must be an object when provided");
    } else {
      for (const [assetId, assetUrl] of Object.entries(candidate.assets)) {
        if (typeof assetUrl !== "string" || assetUrl.trim().length === 0) {
          errors.push(`assets.${assetId} must be a non-empty string URL or file URL`);
        }
      }
    }
  }

  if (candidate.globalAssets !== undefined) {
    if (!isRecord(candidate.globalAssets)) {
      errors.push("globalAssets must be an object when provided");
    } else {
      if (
        candidate.globalAssets.bgmId !== undefined &&
        typeof candidate.globalAssets.bgmId !== "string"
      ) {
        errors.push("globalAssets.bgmId must be a string when provided");
      }
      if (
        candidate.globalAssets.bgmVolume !== undefined &&
        (typeof candidate.globalAssets.bgmVolume !== "number" ||
          candidate.globalAssets.bgmVolume < 0 ||
          candidate.globalAssets.bgmVolume > 1)
      ) {
        errors.push("globalAssets.bgmVolume must be a number between 0 and 1 when provided");
      }
    }
  }

  if (errors.length > 0 || !isRenderSpec(candidate)) {
    return {
      ok: false,
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    errors: [],
    warnings,
    value: candidate,
  };
}

export function parseRenderSpecCandidate(
  source: string,
  options: ParseRenderSpecCandidateOptions = {},
): ParseRenderSpecCandidateResult {
  const warnings: string[] = [];
  const trimmed = source.trim();
  let jsonText = trimmed;

  if (!startsAsJsonObject(trimmed)) {
    if (!options.allowExtract) {
      return {
        ok: false,
        errors: ["RenderSpec JSON is wrapped in non-JSON text"],
        warnings,
      };
    }

    const extracted = extractFirstJsonObject(trimmed);
    if (!extracted) {
      return {
        ok: false,
        errors: ["No RenderSpec JSON object could be extracted"],
        warnings,
      };
    }
    jsonText = extracted;
    warnings.push("Extracted RenderSpec JSON from non-JSON wrapper");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return {
      ok: false,
      errors: [
        `RenderSpec JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
      warnings,
    };
  }

  parsed = normalizeRenderSpecCandidate(parsed, warnings);

  const report = validateRenderSpec(parsed);
  if (!report.ok) {
    return {
      ok: false,
      errors: report.errors,
      warnings: [...warnings, ...report.warnings],
    };
  }

  return {
    ok: true,
    errors: [],
    warnings: [...warnings, ...report.warnings],
    value: report.value,
  };
}

export function validateRenderSpecOrThrow(candidate: unknown): RenderSpec {
  const report = validateRenderSpec(candidate);
  if (!report.ok) {
    throw new Error(`Invalid RenderSpec:\n${report.errors.join("\n")}`);
  }
  return report.value;
}
