/**
 * SaaSReels to HyperFrames Translator
 * Maps SaaSReels RenderSpec components to HyperFrames-ready HTML/GSAP compositions.
 */

export interface RenderSpec {
  fps: 30 | 60;
  format: "9:16" | "16:9" | "1:1";
  totalFrames: number;
  scenes: RenderScene[];
  assets?: Record<string, string>; // mapping from mediaElementId -> remote URL
  globalAssets?: {
    bgmId?: string;
    bgmVolume?: number;
  };
}

export interface RenderScene {
  durationFrames: number;
  component: string;
  mediaElementId: string;
  params: Record<string, any>;
  narration?: {
    audioId: string; // Id to look up in assets
    duration?: number; // duration in seconds
  };
  text?: {
    content: string;
    position: "top" | "center" | "bottom";
    style: "headline" | "subhead" | "caption";
  };
}

function getMediaTag(id: string, url: string | undefined): string {
  if (!url) return "";

  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  const isVideo = ["mp4", "webm", "mov"].includes(ext || "");
  const localPath = `${id}${ext ? "." + ext : ""}`;

  if (isVideo) {
    return `<video src="${localPath}" autoplay loop muted playsinline class="bg-media"></video>`;
  }
  return `<img src="${localPath}" class="bg-media" />`;
}

export function translateRenderSpecToHtml(spec: RenderSpec): string {
  const { fps = 30, totalFrames = 30, scenes = [], assets = {} } = spec || {};
  const totalDuration = totalFrames / fps;
  const isVertical = spec.format === "9:16";
  const isSquare = spec.format === "1:1";
  const [width, height] = isVertical ? [1080, 1920] : isSquare ? [1080, 1080] : [1920, 1080];

  // Scale factors based on width to keep text proportional
  const fontSizeHeadline = Math.round(110 * (isVertical ? 0.8 : 1) * (isSquare ? 0.9 : 1));
  const fontSizeSubhead = Math.round(64 * (isVertical ? 0.8 : 1));

  let currentTime = 0;
  const sceneElements = scenes
    .map((scene, index) => {
      const duration = scene.durationFrames / fps;
      const start = currentTime;
      currentTime += duration;

      const mediaTag = getMediaTag(scene.mediaElementId, assets[scene.mediaElementId]);

      let componentContent = "";
      if (scene.component === "GenerativeDemo") {
        componentContent = `<div class="window-mockup">${mediaTag}</div>`;
      } else if (scene.component === "FocusShot") {
        componentContent = `<div class="focus-circle">${mediaTag}</div>`;
      } else if (scene.component === "SplitScreen") {
        const secondaryTag = getMediaTag(
          scene.params.secondaryMediaId,
          assets[scene.params.secondaryMediaId],
        );
        const layout = scene.params.layout === "vertical" ? "split-vertical" : "split-horizontal";
        componentContent = `
        <div class="split-container ${layout}">
          <div class="split-side">${mediaTag}</div>
          <div class="split-side">${secondaryTag}</div>
        </div>`;
      } else if (scene.component === "HeroContent") {
        componentContent = `
        <div class="hero-bg">${mediaTag}</div>
        <div class="hero-overlay"></div>
      `;
      } else {
        componentContent = mediaTag;
      }

      const textContent = scene.text
        ? `<div class="text-overlay ${scene.text.style} ${scene.text.position}">${scene.text.content}</div>`
        : "";

      let narrationTag = "";
      if (scene.narration?.audioId && assets[scene.narration.audioId]) {
        const audioId = scene.narration.audioId;
        const url = assets[audioId];
        const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "mp3";
        const audioPath = `${audioId}.${ext}`;
        // Narration usually plays at full volume (1.0)
        narrationTag = `<audio id="${audioId}" src="${audioPath}" data-composition-id="main" data-start="${start}" data-duration="${duration}" data-volume="1.0"></audio>`;
      }

      return `
    <!-- Scene ${index + 1}: ${scene.component} -->
    <div 
      class="clip clip-${scene.component.toLowerCase()}" 
      id="scene-${index}" 
      data-start="${start}" 
      data-duration="${duration}"
      style="background: ${scene.params.bgGlowColor || "transparent"}"
    >
      ${componentContent}
      ${textContent}
      ${narrationTag}
      <div class="debug-label">${scene.component}</div>
    </div>`;
    })
    .join("\n");

  // Global Audio (BGM)
  let audioTag = "";
  if (spec.globalAssets?.bgmId && assets[spec.globalAssets.bgmId]) {
    const bgmId = spec.globalAssets.bgmId;
    const url = assets[bgmId];
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "mp3";
    const bgmPath = `${bgmId}.${ext}`;
    const volume = spec.globalAssets.bgmVolume ?? 0.5;
    audioTag = `<audio id="${bgmId}" src="${bgmPath}" data-composition-id="main" data-start="0" data-duration="${totalDuration}" data-volume="${volume}"></audio>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}, height=${height}">
  <title>SaaSReels MVP</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Noto+Sans+SC:wght@400;700;900&display=swap" rel="stylesheet">
  <script src="gsap.js"></script>
  <style>
    body, html { margin: 0; padding: 0; width: ${width}px; height: ${height}px; background: #000; overflow: hidden; font-family: 'Outfit', 'Noto Sans SC', sans-serif; color: #fff; }
    #root { position: relative; width: 100%; height: 100%; background: #000; }
    
    .clip { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; visibility: hidden; overflow: hidden; }
    
    .bg-media {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 1;
    }
    
    /* GenerativeDemo */
    .clip-generativedemo .window-mockup {
      width: ${isVertical ? "90%" : "85%"};
      height: ${isVertical ? "50%" : "65%"};
      background: #000;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px;
      box-shadow: 0 50px 100px rgba(0,0,0,0.8), 0 0 40px rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      z-index: 5;
    }
    
    /* FocusShot */
    .clip-focusshot .focus-circle {
      width: ${isVertical ? "80vw" : "600px"};
      height: ${isVertical ? "80vw" : "600px"};
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      z-index: 5;
    }

    /* SplitScreen */
    .split-container {
      display: flex;
      width: 100%;
      height: 100%;
      z-index: 2;
    }
    .split-horizontal { flex-direction: row; }
    .split-vertical { flex-direction: column; }
    .split-side {
      flex: 1;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.1);
    }

    /* HeroContent */
    .hero-bg { position: absolute; inset: 0; z-index: 1; filter: brightness(0.7) scale(1.1); }
    .hero-overlay { 
      position: absolute; inset: 0; 
      background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%);
      z-index: 2;
    }

    /* Typography */
    .text-overlay { position: relative; z-index: 20; text-align: center; max-width: 90%; pointer-events: none; text-shadow: 0 4px 12px rgba(0,0,0,0.5); }
    .headline { font-size: ${fontSizeHeadline}px; font-weight: 900; letter-spacing: -0.05em; line-height: 0.95; margin-bottom: 30px; text-transform: uppercase; }
    .subhead { font-size: ${fontSizeSubhead}px; font-weight: 700; color: #fff; }
    .caption { font-size: 38px; font-weight: 400; color: rgba(255,255,255,0.8); background: rgba(0,0,0,0.4); padding: 10px 24px; border-radius: 12px; backdrop-filter: blur(8px); }
    
    .top { margin-bottom: auto; padding-top: 140px; }
    .center { margin: auto; }
    .bottom { margin-top: auto; padding-bottom: 140px; }

    .debug-label { position: absolute; bottom: 40px; right: 40px; font-size: 12px; opacity: 0.2; font-family: monospace; z-index: 100; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="main" data-duration="${totalDuration}" data-width="${width}" data-height="${height}">
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
        
        // --- Entrance ---
        tl.set(clip, { visibility: 'visible' }, start);
        tl.fromTo(clip, { opacity: 0 }, { opacity: 1, duration: 0.4 }, start);
        
        // --- Component Animations ---
        if (comp === 'generativedemo') {
          tl.fromTo(clip.querySelector('.window-mockup'), 
            { y: 150, scale: 0.8, rotateX: 15, opacity: 0 }, 
            { y: 0, scale: 1, rotateX: 0, opacity: 1, duration: 1.2, ease: "expo.out" }, 
            start + 0.1
          );
        } else if (comp === 'focusshot') {
          tl.fromTo(clip.querySelector('.focus-circle'),
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 1, ease: "back.out(1.2)" },
            start + 0.2
          );
        } else if (comp === 'splitscreen') {
          const sides = clip.querySelectorAll('.split-side');
          tl.fromTo(sides[0], { xPercent: -100 }, { xPercent: 0, duration: 1, ease: "power4.out" }, start);
          tl.fromTo(sides[1], { xPercent: 100 }, { xPercent: 0, duration: 1, ease: "power4.out" }, start);
        } else if (comp === 'herocontent') {
          tl.fromTo(clip.querySelector('.hero-bg'), { scale: 1.3 }, { scale: 1, duration: duration, ease: "none" }, start);
        }

        // --- Global Background Ken Burns ---
        const bgMedia = clip.querySelector('.bg-media');
        if (bgMedia && !clip.classList.contains('clip-herocontent')) {
          tl.fromTo(bgMedia, { scale: 1.2, rotate: 1 }, { scale: 1, rotate: 0, duration: duration, ease: "none" }, start);
        }

        // --- Text Entrance ---
        const text = clip.querySelector('.text-overlay');
        if (text) {
          tl.fromTo(text, { y: 60, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1, ease: "power3.out" }, start + 0.5);
        }
        
        // --- Exit ---
        tl.to(clip, { opacity: 0, duration: 0.4 }, start + duration - 0.4);
        tl.set(clip, { visibility: 'hidden' }, start + duration);
      });
    })();
  </script>
</body>
</html>`;
}
