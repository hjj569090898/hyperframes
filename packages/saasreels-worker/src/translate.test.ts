import test from "node:test";
import assert from "node:assert";
import { translateRenderSpecToHtml, type RenderSpec } from "./translate.js";

test("translateRenderSpecToHtml should generate valid HyperFrames HTML architecture", () => {
  const mockSpec: RenderSpec = {
    fps: 30,
    format: "16:9",
    totalFrames: 60,
    scenes: [
      {
        durationFrames: 30,
        component: "GenerativeDemo",
        mediaElementId: "asset_1",
        params: {
          zoom: 1.2,
          easing: "power2.inOut",
          bgGlowColor: "#ff0000",
          transitionType: "zoom",
        },
        text: {
          content: "Hello SaaSReels",
          position: "center",
          style: "headline",
        },
      },
      {
        durationFrames: 30,
        component: "FocusShot",
        mediaElementId: "asset_2",
        params: {
          zoom: 1.1,
          easing: "power3.out",
          bgGlowColor: "#00ff00",
          transitionType: "fade",
        },
      },
    ],
  };

  const html = translateRenderSpecToHtml(mockSpec);

  // Structural checks
  assert.ok(html.includes('<div id="root"'), "Should contain root div");
  assert.ok(html.includes('data-composition-id="main"'), "Should contain main composition ID");
  assert.ok(html.includes('data-start="0"'), "Should set root composition start to 0");
  assert.ok(html.includes('data-duration="2"'), "Should have correct total duration (2s)");

  // Scene content checks
  assert.ok(html.includes("Hello SaaSReels"), "Should contain text content");
  assert.ok(html.includes("GenerativeDemo"), "Should contain scene component name");
  assert.ok(html.includes("FocusShot"), "Should contain second scene component name");

  // GSAP Registration check
  assert.ok(html.includes('window.__timelines["main"] = tl'), "Should register main timeline");
});
