import test from "node:test";
import assert from "node:assert/strict";

import {
  parseRenderSpecCandidate,
  validateRenderSpec,
  validateRenderSpecOrThrow,
} from "./renderSpecValidation.js";
import type { RenderSpec } from "./translate.js";

const validSpec: RenderSpec = {
  fps: 30,
  format: "16:9",
  totalFrames: 180,
  scenes: [
    {
      component: "HeroContent",
      mediaElementId: "hero",
      durationFrames: 90,
      text: {
        content: "Launch videos from one URL",
        style: "headline",
        position: "center",
      },
      params: {
        bgGlowColor: "#050505",
      },
    },
    {
      component: "UnifiedCTA",
      mediaElementId: "hero",
      durationFrames: 90,
      text: {
        content: "Create your campaign today",
        style: "headline",
        position: "center",
      },
      params: {},
    },
  ],
  assets: {
    hero: "https://cdn.example.com/hero.png",
  },
};

test("validateRenderSpec accepts a structurally valid RenderSpec", () => {
  const report = validateRenderSpec(validSpec);

  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test("validateRenderSpec rejects missing durationFrames and mismatched totalFrames", () => {
  const report = validateRenderSpec({
    ...validSpec,
    totalFrames: 180,
    scenes: [
      {
        component: "HeroContent",
        mediaElementId: "hero",
        text: {
          content: "Missing duration",
          style: "headline",
          position: "center",
        },
        params: {},
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /scenes\[0\]\.durationFrames/);
  assert.match(report.errors.join("\n"), /totalFrames/);
});

test("validateRenderSpec rejects drift fields from model output", () => {
  const report = validateRenderSpec({
    ...validSpec,
    scenes: [
      {
        type: "HeroContent",
        duration: 3,
        content: "Wrong field",
        component: "HeroContent",
        mediaElementId: "hero",
        durationFrames: 90,
        params: {},
      },
    ],
    totalFrames: 90,
  });

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /scene\.type/);
  assert.match(report.errors.join("\n"), /scene\.duration/);
  assert.match(report.errors.join("\n"), /scene\.content/);
});

test("parseRenderSpecCandidate rejects Markdown-wrapped JSON by default", () => {
  const source = `Here is the RenderSpec:\n\n\`\`\`json\n${JSON.stringify(validSpec)}\n\`\`\``;
  const parsed = parseRenderSpecCandidate(source);

  assert.equal(parsed.ok, false);
  assert.match(parsed.errors.join("\n"), /wrapped in non-JSON text/);
});

test("parseRenderSpecCandidate extracts Markdown-wrapped JSON in repair mode", () => {
  const source = `Here is the RenderSpec:\n\n\`\`\`json\n${JSON.stringify(validSpec)}\n\`\`\``;
  const parsed = parseRenderSpecCandidate(source, { allowExtract: true });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.warnings.length, 1);
  assert.deepEqual(parsed.value, validSpec);
});

test("parseRenderSpecCandidate normalizes common text style aliases from model output", () => {
  const aliasedSpec = {
    ...validSpec,
    scenes: [
      {
        ...validSpec.scenes[0],
        text: {
          content: "Lead with the hook",
          style: "subheadline",
          position: "center",
        },
      },
      {
        ...validSpec.scenes[1],
        text: {
          content: "Start Free",
          style: "call_to_action",
          position: "center",
        },
      },
    ],
  };

  const parsed = parseRenderSpecCandidate(JSON.stringify(aliasedSpec));

  assert.equal(parsed.ok, true);
  assert.match(parsed.warnings.join("\n"), /Normalized scenes\[0\]\.text\.style/);
  assert.match(parsed.warnings.join("\n"), /Normalized scenes\[1\]\.text\.style/);
  assert.equal(parsed.value.scenes[0]?.text?.style, "subhead");
  assert.equal(parsed.value.scenes[1]?.text?.style, "headline");
});

test("validateRenderSpecOrThrow reports blocking errors", () => {
  assert.throws(
    () =>
      validateRenderSpecOrThrow({
        ...validSpec,
        totalFrames: 1,
      }),
    /Invalid RenderSpec/,
  );
});
