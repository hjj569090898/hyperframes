/**
 * SaaSReels to HyperFrames Translator
 * Maps SaaSReels RenderSpec components to HyperFrames-ready HTML/GSAP compositions.
 */

export interface RenderSpec {
  fps: 30 | 60;
  format: "9:16" | "16:9" | "1:1";
  totalFrames: number;
  scenes: RenderScene[];
  assets?: Record<string, string>;
  globalAssets?: {
    bgmId?: string;
    bgmVolume?: number;
  };
}

export interface RenderScene {
  durationFrames: number;
  component: string;
  mediaElementId: string;
  params: Record<string, unknown>;
  narration?: {
    audioId: string;
    duration?: number;
  };
  text?: {
    content: string;
    position: "top" | "center" | "bottom";
    style: "headline" | "subhead" | "caption";
  };
}

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v"]);

export function sanitizeRenderAssetId(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return sanitized || "asset";
}

function extensionFromUrl(url: string | undefined): string {
  if (!url) return "";

  let cleanPath = url;
  try {
    cleanPath = new URL(url).pathname;
  } catch {
    cleanPath = url.split("?")[0]?.split("#")[0] ?? url;
  }

  const fileName = cleanPath.split("/").pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === fileName.length - 1) return "";

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(extension) ? extension : "";
}

export function renderAssetFileName(id: string, url: string | undefined): string {
  const extension = extensionFromUrl(url);
  return `${sanitizeRenderAssetId(id)}${extension ? `.${extension}` : ""}`;
}

function renderAssetPath(id: string, url: string | undefined): string {
  return `assets/${renderAssetFileName(id, url)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function getParamString(params: Record<string, unknown>, key: string, fallback: string): string {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function getMediaTag(id: string, url: string | undefined): string {
  if (!url || id.trim().length === 0) return "";

  const src = escapeHtml(renderAssetPath(id, url));
  const extension = extensionFromUrl(url);
  if (VIDEO_EXTENSIONS.has(extension)) {
    return `<video src="${src}" class="bg-media" data-composition-id="main" muted loop playsinline></video>`;
  }

  return `<img src="${src}" class="bg-media" />`;
}

function getAudioTag(
  id: string,
  url: string,
  startTime: number,
  duration: number | undefined,
  volume: number,
): string {
  const durationAttr = duration ? ` data-duration="${duration}"` : "";
  return `<audio id="${escapeHtml(id)}" src="${escapeHtml(renderAssetPath(id, url))}" data-composition-id="main" data-start="${startTime}"${durationAttr} data-volume="${volume}"></audio>`;
}

function getSfxTag(
  type: "whoosh" | "click" | "pop" | "impact",
  startTime: number,
  assets: Record<string, string>,
): string {
  const sfxId = `sfx_${type}`;
  const url = assets[sfxId];
  if (!url) return "";

  return getAudioTag(`${sfxId}_${Math.floor(startTime * 1000)}`, url, startTime, undefined, 0.6);
}

function getFeatureCards(content: string | undefined): string {
  const points =
    content
      ?.split(/[.;\n]/)
      .map((point) => point.trim())
      .filter(Boolean)
      .slice(0, 3) ?? [];
  const normalizedPoints =
    points.length > 0 ? points : ["Launch faster", "Stay consistent", "Convert more"];

  return normalizedPoints
    .map(
      (point, index) => `
          <div class="feature-card" style="--i: ${index}">
            <div class="feature-icon">OK</div>
            <div class="feature-text">${escapeHtml(point)}</div>
          </div>
        `,
    )
    .join("");
}

export function translateRenderSpecToHtml(spec: RenderSpec): string {
  const { fps = 30, totalFrames = 30, scenes = [], assets = {} } = spec;
  const totalDuration = totalFrames / fps;
  const isVertical = spec.format === "9:16";
  const isSquare = spec.format === "1:1";
  const [width, height] = isVertical ? [1080, 1920] : isSquare ? [1080, 1080] : [1920, 1080];

  const fontSizeHeadline = Math.round(110 * (isVertical ? 0.8 : 1) * (isSquare ? 0.9 : 1));
  const fontSizeSubhead = Math.round(64 * (isVertical ? 0.8 : 1));

  let currentTime = 0;
  const sceneElements = scenes
    .map((scene, index) => {
      const duration = scene.durationFrames / fps;
      const start = currentTime;
      currentTime += duration;

      const params = scene.params ?? {};
      const mediaTag = getMediaTag(scene.mediaElementId, assets[scene.mediaElementId]);
      const component = scene.component || "HeroContent";
      const componentName = component.toLowerCase();
      const textValue = scene.text?.content;
      let sfxTags = "";
      let componentContent = "";

      if (componentName === "generativedemo") {
        componentContent = `<div class="window-mockup">${mediaTag}</div>`;
        sfxTags += getSfxTag("whoosh", start + 0.1, assets);
      } else if (componentName === "focusshot") {
        componentContent = `<div class="focus-circle">${mediaTag}</div>`;
        sfxTags += getSfxTag("pop", start + 0.2, assets);
      } else if (componentName === "splitscreen") {
        const secondaryMediaId = getParamString(params, "secondaryMediaId", "");
        const secondaryTag = getMediaTag(secondaryMediaId, assets[secondaryMediaId]);
        const layout =
          getParamString(params, "layout", "horizontal") === "vertical"
            ? "split-vertical"
            : "split-horizontal";
        componentContent = `
        <div class="split-container ${layout}">
          <div class="split-side">${mediaTag}</div>
          <div class="split-side">${secondaryTag}</div>
        </div>`;
        sfxTags += getSfxTag("whoosh", start, assets);
      } else if (componentName === "featurehighlight") {
        componentContent = `<div class="feature-grid">${getFeatureCards(textValue)}</div>`;
        sfxTags += getSfxTag("whoosh", start, assets);
      } else if (componentName === "testimonialsocialproof" || componentName === "socialproof") {
        componentContent = `
          <div class="social-proof-container">
            <div class="proof-badge">TRUSTED BY TEAMS</div>
            <div class="proof-stars">5/5</div>
            <div class="proof-text">${escapeHtml(textValue || "Saving hours daily")}</div>
          </div>
        `;
        sfxTags += getSfxTag("impact", start, assets);
      } else if (componentName === "unifiedcta") {
        componentContent = `
          <div class="cta-container">
             <div class="cta-title">${escapeHtml(textValue || "Start now")}</div>
             <div class="cta-button">GET STARTED</div>
          </div>
        `;
        sfxTags += getSfxTag("impact", start, assets);
      } else if (componentName === "herocontent") {
        componentContent = `
        <div class="hero-bg">${mediaTag}</div>
        <div class="hero-overlay"></div>
      `;
        sfxTags += getSfxTag("impact", start, assets);
      } else {
        componentContent = mediaTag;
      }

      const sceneText = scene.text;
      const shouldShowText =
        sceneText &&
        componentName !== "featurehighlight" &&
        componentName !== "socialproof" &&
        componentName !== "testimonialsocialproof" &&
        componentName !== "unifiedcta";
      const textContent = shouldShowText
        ? `<div class="text-overlay ${sceneText.style} ${sceneText.position}">${escapeHtml(textValue || "")}</div>`
        : "";

      if (scene.text) {
        sfxTags += getSfxTag("pop", start + 0.7, assets);
      }

      let narrationTag = "";
      if (scene.narration?.audioId) {
        const audioId = scene.narration.audioId;
        const url = assets[audioId];
        if (url) {
          narrationTag = getAudioTag(audioId, url, start, duration, 1);
        }
      }

      let stockVideoTag = "";
      const stockVideoId = getParamString(params, "stockVideoId", "");
      if (stockVideoId) {
        const url = assets[stockVideoId];
        if (url) {
          stockVideoTag = `<video class="bg-media stock-video" src="${escapeHtml(renderAssetPath(stockVideoId, url))}" data-composition-id="main" muted loop playsinline></video>`;
        }
      }

      const transition = escapeHtml(getParamString(params, "transition", "fade_in"));
      const background = escapeHtml(getParamString(params, "bgGlowColor", "transparent"));
      const escapedComponent = escapeHtml(component);

      return `
    <!-- Scene ${index + 1}: ${escapedComponent} -->
    <div
      class="clip clip-${escapeHtml(componentName)}"
      id="scene-${index}"
      data-start="${start}"
      data-duration="${duration}"
      data-transition="${transition}"
      style="background: ${background}"
    >
      ${stockVideoTag}
      ${componentContent}
      ${textContent}
      ${narrationTag}
      ${sfxTags}
      <div class="debug-label">${escapedComponent}</div>
    </div>`;
    })
    .join("\n");

  let audioTag = "";
  if (spec.globalAssets?.bgmId) {
    const bgmId = spec.globalAssets.bgmId;
    const url = assets[bgmId];
    const volume = spec.globalAssets.bgmVolume ?? 0.5;
    if (url) {
      audioTag = getAudioTag(bgmId, url, 0, totalDuration, volume);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}, height=${height}">
  <title>SaaSReels MVP</title>
  <link rel="icon" href="data:,">
  <script src="gsap.js"></script>
  <style>
    body, html { margin: 0; padding: 0; width: ${width}px; height: ${height}px; background: #000; overflow: hidden; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #fff; }
    #root { position: relative; width: 100%; height: 100%; background: #050505; perspective: 1500px; }

    .clip { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; visibility: hidden; overflow: hidden; }

    .bg-media {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 1;
    }

    .stock-video { filter: brightness(0.4) blur(4px); transform: scale(1.1); }

    .clip-generativedemo .window-mockup, .stack-card {
      width: ${isVertical ? "92%" : "80%"};
      height: ${isVertical ? "45%" : "60%"};
      background: rgba(0, 5, 20, 0.6);
      border: 1px solid rgba(100, 200, 255, 0.4);
      border-radius: 28px;
      box-shadow:
        0 40px 120px -30px rgba(0, 10, 50, 0.9),
        0 0 20px rgba(0, 150, 255, 0.2),
        inset 0 0 80px rgba(0, 150, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      z-index: 5;
      backdrop-filter: blur(25px);
      transform-style: preserve-3d;
    }

    .clip-generativedemo .window-mockup::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; height: 40px;
      background: linear-gradient(to right, rgba(255,255,255,0.1), transparent);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      z-index: 6;
    }

    .clip-focusshot .focus-circle {
      width: ${isVertical ? "85vw" : "650px"};
      height: ${isVertical ? "85vw" : "650px"};
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      z-index: 5;
      box-shadow: 0 0 100px rgba(255,255,255,0.1);
    }

    .split-container { display: flex; width: 100%; height: 100%; z-index: 2; }
    .split-horizontal { flex-direction: row; }
    .split-vertical { flex-direction: column; }
    .split-side { flex: 1; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }

    .hero-bg { position: absolute; inset: 0; z-index: 1; filter: brightness(0.6); transform: scale(1.15); }
    .hero-overlay {
      position: absolute; inset: 0;
      background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 100%);
      z-index: 2;
    }

    .text-overlay {
      position: relative; z-index: 30; text-align: center; max-width: 85%; pointer-events: none;
      filter: drop-shadow(0 10px 20px rgba(0,0,0,0.8));
    }
    .headline {
      font-size: ${fontSizeHeadline}px; font-weight: 900; letter-spacing: 0; line-height: 1.0;
      margin-bottom: 30px; text-transform: uppercase;
      background: linear-gradient(135deg, #fff 0%, #aaa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subhead {
      font-size: ${fontSizeSubhead}px; font-weight: 700; color: #fff;
      letter-spacing: 0; line-height: 1.2;
      text-shadow: 0 5px 15px rgba(0,0,0,0.5);
    }
    .caption {
      font-size: 42px; font-weight: 500; color: #fff;
      border: 1px solid rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.1); padding: 12px 32px; border-radius: 100px; backdrop-filter: blur(12px);
    }

    .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; width: 90%; z-index: 5; }
    .feature-card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 40px;
      border-radius: 40px; text-align: center; backdrop-filter: blur(20px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    }
    .feature-icon { font-size: 42px; margin-bottom: 20px; font-weight: 900; }
    .feature-text { font-size: 32px; font-weight: 700; color: #fff; text-transform: uppercase; }

    .social-proof-container { z-index: 10; text-align: center; background: rgba(0,0,0,0.4); padding: 60px; border-radius: 60px; backdrop-filter: blur(30px); border: 1px solid rgba(160, 255, 160, 0.2); }
    .proof-badge { font-size: 24px; font-weight: 900; background: #10b981; color: #000; padding: 8px 24px; border-radius: 100px; display: inline-block; margin-bottom: 20px; }
    .proof-stars { font-size: 48px; color: #fbbf24; margin-bottom: 20px; }
    .proof-text { font-size: 60px; font-weight: 900; color: #fff; }

    .cta-container { z-index: 10; text-align: center; }
    .cta-title { font-size: 100px; font-weight: 900; margin-bottom: 60px; text-transform: uppercase; }
    .cta-button { font-size: 40px; font-weight: 900; background: linear-gradient(135deg, #6366f1, #a855f7); padding: 30px 80px; border-radius: 100px; display: inline-block; box-shadow: 0 0 50px rgba(99, 102, 241, 0.4); }

    .top { margin-bottom: auto; padding-top: 160px; }
    .center { margin: auto; }
    .bottom { margin-top: auto; padding-bottom: 160px; }

    .debug-label { position: absolute; bottom: 40px; right: 40px; font-size: 10px; opacity: 0.1; font-family: monospace; z-index: 100; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="${totalDuration}" data-width="${width}" data-height="${height}">
    ${sceneElements}
    ${audioTag}
  </div>

  <script>
    (function() {
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;

      document.querySelectorAll('.clip').forEach((clip) => {
        const start = parseFloat(clip.dataset.start);
        const duration = parseFloat(clip.dataset.duration);
        const comp = clip.classList[1].replace('clip-', '');
        const transition = clip.dataset.transition;

        tl.set(clip, { visibility: 'visible' }, start);

        if (transition === 'scale_up') {
          tl.fromTo(clip, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" }, start);
        } else if (transition === 'slide_left') {
          tl.fromTo(clip, { opacity: 0, x: 500 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, start);
        } else if (transition === 'slide_right') {
          tl.fromTo(clip, { opacity: 0, x: -500 }, { opacity: 1, x: 0, duration: 0.8, ease: "power3.out" }, start);
        } else if (transition === 'flip_center') {
          tl.fromTo(clip, { opacity: 0, rotateY: 90 }, { opacity: 1, rotateY: 0, duration: 1, ease: "expo.out" }, start);
        } else {
          tl.fromTo(clip, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.inOut" }, start);
        }

        if (comp === 'generativedemo') {
          tl.fromTo(clip.querySelector('.window-mockup'),
            { y: 300, scale: 0.7, rotateX: 25, rotateY: -10, opacity: 0 },
            { y: 0, scale: 1, rotateX: 0, rotateY: 0, opacity: 1, duration: 1.6, ease: "expo.out" },
            start + 0.1
          );
        } else if (comp === 'featurehighlight') {
          tl.fromTo(clip.querySelectorAll('.feature-card'),
            { y: 100, opacity: 0, rotateX: -30 },
            { y: 0, opacity: 1, rotateX: 0, duration: 1, stagger: 0.15, ease: "back.out" },
            start + 0.3
          );
        } else if (comp === 'testimonialsocialproof' || comp === 'socialproof') {
          tl.fromTo(clip.querySelector('.social-proof-container'),
            { scale: 0.5, opacity: 0, z: -500 },
            { scale: 1, opacity: 1, z: 0, duration: 1.2, ease: "elastic.out(1, 0.75)" },
            start + 0.2
          );
        } else if (comp === 'unifiedcta') {
          tl.fromTo(clip.querySelector('.cta-title'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, start + 0.5);
          tl.fromTo(clip.querySelector('.cta-button'), { scale: 0, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.8, ease: "back.out" }, start + 1);
          tl.to(clip.querySelector('.cta-button'), { scale: 1, duration: 0.3 }, start + 1.8);
        } else if (comp === 'herocontent') {
          tl.fromTo(clip.querySelector('.hero-bg'),
            { scale: 1.2, x: -50 },
            { scale: 1, x: 0, duration: duration, ease: "power1.inOut" },
            start
          );
        }

        const bgMedia = clip.querySelector('.bg-media');
        if (bgMedia) {
          tl.fromTo(bgMedia,
            { scale: 1.1, x: -20, y: -10 },
            { scale: 1.3, x: 20, y: 10, duration: duration, ease: "none" },
            start
          );
        }

        const text = clip.querySelector('.text-overlay');
        if (text) {
          tl.fromTo(text,
            { y: 40, opacity: 0, filter: 'blur(12px)', skewY: 2 },
            { y: 0, opacity: 1, filter: 'blur(0px)', skewY: 0, duration: 1.2, ease: "power3.out" },
            start + 0.7
          );
        }

        tl.to(clip, { opacity: 0, y: -50, filter: 'blur(20px)', duration: 0.6, ease: "power2.in" }, start + duration - 0.6);
        tl.set(clip, { visibility: 'hidden' }, start + duration);
      });
    })();
  </script>
</body>
</html>
`;
}
