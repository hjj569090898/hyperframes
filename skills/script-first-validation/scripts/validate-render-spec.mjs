#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const ALLOWED_COMPONENTS = new Set([
  "HeroContent",
  "GenerativeDemo",
  "FocusShot",
  "FeatureHighlight",
  "SocialProof",
  "TestimonialSocialProof",
  "UnifiedCTA",
  "SplitScreen",
]);

const ALLOWED_FORMATS = new Set(["16:9", "9:16", "1:1"]);
const ALLOWED_FPS = new Set([30, 60]);
const ALLOWED_TEXT_STYLES = new Set(["headline", "subhead", "caption"]);
const ALLOWED_TEXT_POSITIONS = new Set(["top", "center", "bottom"]);
const DRIFT_FIELDS = new Map([
  ["type", "Use scene.component instead of scene.type."],
  ["duration", "Use scene.durationFrames instead of scene.duration."],
  ["content", "Put headline copy in scene.text.content, not scene.content."],
]);

function printUsage() {
  console.log(`Usage: node validate-render-spec.mjs <render-spec-file> [--allow-extract]

Validates a SaaSReels RenderSpec before enqueue, materialization, preview, or render.

Options:
  --allow-extract   Attempt to extract the first balanced JSON object from wrapped text.
  --help            Show this help message.
`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function describePath(path, message) {
  return `${path}: ${message}`;
}

function extractFirstJsonObject(source) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseRenderSpec(source, allowExtract) {
  const trimmed = source.trim();
  try {
    return {
      spec: JSON.parse(trimmed),
      warnings: [],
      errors: [],
    };
  } catch (error) {
    const candidate = extractFirstJsonObject(source);
    if (!candidate) {
      return {
        spec: null,
        warnings: [],
        errors: [`input: Failed to parse JSON (${error.message}).`],
      };
    }

    if (!allowExtract) {
      return {
        spec: null,
        warnings: [],
        errors: [
          "input: RenderSpec is wrapped in non-JSON text. Return pure JSON only, or rerun with --allow-extract for repair workflows.",
        ],
      };
    }

    try {
      return {
        spec: JSON.parse(candidate),
        warnings: [
          "input: Extracted a JSON object from wrapped text. The final RenderSpec should be pure JSON.",
        ],
        errors: [],
      };
    } catch (nestedError) {
      return {
        spec: null,
        warnings: [],
        errors: [`input: Extracted JSON candidate is invalid (${nestedError.message}).`],
      };
    }
  }
}

function validateAssets(spec, errors, warnings) {
  if (spec.assets === undefined) {
    warnings.push("assets: Missing assets map; asset ownership cannot be checked.");
    return { assets: {}, canCheck: false };
  }

  if (!isPlainObject(spec.assets)) {
    errors.push("assets: Must be an object mapping mediaElementId to URL/path.");
    return { assets: {}, canCheck: false };
  }

  const assets = spec.assets;
  for (const [id, value] of Object.entries(assets)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(describePath(`assets.${id}`, "Asset value must be a non-empty string."));
    }
  }

  return { assets, canCheck: true };
}

function checkAssetReference(id, path, assets, canCheck, errors) {
  if (typeof id !== "string" || id.trim().length === 0) {
    errors.push(describePath(path, "Must be a non-empty asset id string."));
    return;
  }

  if (canCheck && !(id in assets)) {
    errors.push(describePath(path, `References missing asset "${id}".`));
  }
}

function validateText(text, path, errors) {
  if (text === undefined) return;
  if (!isPlainObject(text)) {
    errors.push(describePath(path, "Must be an object when present."));
    return;
  }

  if (typeof text.content !== "string" || text.content.trim().length === 0) {
    errors.push(describePath(`${path}.content`, "Must be a non-empty string."));
  }
  if (!ALLOWED_TEXT_STYLES.has(text.style)) {
    errors.push(
      describePath(
        `${path}.style`,
        `Must be one of ${Array.from(ALLOWED_TEXT_STYLES).join(", ")}.`,
      ),
    );
  }
  if (!ALLOWED_TEXT_POSITIONS.has(text.position)) {
    errors.push(
      describePath(
        `${path}.position`,
        `Must be one of ${Array.from(ALLOWED_TEXT_POSITIONS).join(", ")}.`,
      ),
    );
  }
}

function validateScene(scene, index, assets, canCheck, errors, warnings) {
  const path = `scenes[${index}]`;
  if (!isPlainObject(scene)) {
    errors.push(describePath(path, "Must be an object."));
    return 0;
  }

  for (const [field, repair] of DRIFT_FIELDS.entries()) {
    if (Object.hasOwn(scene, field)) {
      errors.push(describePath(`${path}.${field}`, repair));
    }
  }

  if (typeof scene.component !== "string" || scene.component.trim().length === 0) {
    errors.push(describePath(`${path}.component`, "Must be a non-empty string."));
  } else if (!ALLOWED_COMPONENTS.has(scene.component)) {
    errors.push(
      describePath(
        `${path}.component`,
        `Unknown component "${scene.component}". Allowed: ${Array.from(ALLOWED_COMPONENTS).join(", ")}.`,
      ),
    );
  }

  if (!isPositiveInteger(scene.durationFrames)) {
    errors.push(describePath(`${path}.durationFrames`, "Must be a positive integer frame count."));
  }

  checkAssetReference(scene.mediaElementId, `${path}.mediaElementId`, assets, canCheck, errors);

  if (!isPlainObject(scene.params)) {
    errors.push(describePath(`${path}.params`, "Must be an object."));
  } else {
    if (scene.params.secondaryMediaId !== undefined) {
      checkAssetReference(
        scene.params.secondaryMediaId,
        `${path}.params.secondaryMediaId`,
        assets,
        canCheck,
        errors,
      );
    }

    if (scene.params.stockVideoId !== undefined) {
      checkAssetReference(
        scene.params.stockVideoId,
        `${path}.params.stockVideoId`,
        assets,
        canCheck,
        errors,
      );
    }

    if (scene.params.otherAssetIds !== undefined) {
      if (!Array.isArray(scene.params.otherAssetIds)) {
        errors.push(describePath(`${path}.params.otherAssetIds`, "Must be an array when present."));
      } else {
        scene.params.otherAssetIds.forEach((assetId, assetIndex) => {
          checkAssetReference(
            assetId,
            `${path}.params.otherAssetIds[${assetIndex}]`,
            assets,
            canCheck,
            errors,
          );
        });
      }
    }

    if (
      scene.params.pexelsQuery !== undefined &&
      (typeof scene.params.pexelsQuery !== "string" || scene.params.pexelsQuery.trim().length === 0)
    ) {
      errors.push(
        describePath(`${path}.params.pexelsQuery`, "Must be a non-empty string when present."),
      );
    }
  }

  validateText(scene.text, `${path}.text`, errors);

  if (scene.text === undefined) {
    warnings.push(
      describePath(`${path}.text`, "Missing text overlay; confirm this is intentional."),
    );
  }

  if (scene.narration !== undefined) {
    if (!isPlainObject(scene.narration)) {
      errors.push(describePath(`${path}.narration`, "Must be an object when present."));
    } else if (scene.narration.audioId !== undefined) {
      checkAssetReference(
        scene.narration.audioId,
        `${path}.narration.audioId`,
        assets,
        canCheck,
        errors,
      );
    }
  }

  return isPositiveInteger(scene.durationFrames) ? scene.durationFrames : 0;
}

function validateRenderSpec(spec) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(spec)) {
    return { errors: ["root: RenderSpec must be a JSON object."], warnings };
  }

  if (!ALLOWED_FPS.has(spec.fps)) {
    errors.push(`fps: Must be one of ${Array.from(ALLOWED_FPS).join(", ")}.`);
  }
  if (!ALLOWED_FORMATS.has(spec.format)) {
    errors.push(`format: Must be one of ${Array.from(ALLOWED_FORMATS).join(", ")}.`);
  }
  if (!isPositiveInteger(spec.totalFrames)) {
    errors.push("totalFrames: Must be a positive integer.");
  }
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    errors.push("scenes: Must be a non-empty array.");
  }

  const { assets, canCheck } = validateAssets(spec, errors, warnings);
  let summedFrames = 0;

  if (Array.isArray(spec.scenes)) {
    spec.scenes.forEach((scene, index) => {
      summedFrames += validateScene(scene, index, assets, canCheck, errors, warnings);
    });
  }

  if (
    isPositiveInteger(spec.totalFrames) &&
    Array.isArray(spec.scenes) &&
    summedFrames !== spec.totalFrames
  ) {
    errors.push(
      `totalFrames: Expected ${summedFrames} from scene durations, received ${spec.totalFrames}.`,
    );
  }

  if (spec.globalAssets !== undefined) {
    if (!isPlainObject(spec.globalAssets)) {
      errors.push("globalAssets: Must be an object when present.");
    } else {
      if (spec.globalAssets.bgmId !== undefined) {
        checkAssetReference(
          spec.globalAssets.bgmId,
          "globalAssets.bgmId",
          assets,
          canCheck,
          errors,
        );
      }
      if (
        spec.globalAssets.bgmVolume !== undefined &&
        (typeof spec.globalAssets.bgmVolume !== "number" ||
          spec.globalAssets.bgmVolume < 0 ||
          spec.globalAssets.bgmVolume > 1)
      ) {
        errors.push("globalAssets.bgmVolume: Must be a number between 0 and 1.");
      }
    }
  }

  return { errors, warnings };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const allowExtract = args.includes("--allow-extract");
  const filePath = args.find((arg) => !arg.startsWith("--"));
  if (!filePath) {
    printUsage();
    process.exit(1);
  }

  const source = await readFile(filePath, "utf8");
  const parsed = parseRenderSpec(source, allowExtract);
  const validation = parsed.spec ? validateRenderSpec(parsed.spec) : { errors: [], warnings: [] };
  const errors = [...parsed.errors, ...validation.errors];
  const warnings = [...parsed.warnings, ...validation.warnings];
  const report = {
    ok: errors.length === 0,
    file: filePath,
    summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
    errors,
    warnings,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    console.error(`[validate-render-spec] ${basename(filePath)} failed: ${report.summary}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`[validate-render-spec] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
