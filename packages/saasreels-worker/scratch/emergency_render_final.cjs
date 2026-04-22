const { renderVideo } = require("../../producer/dist/index.js");
const fs = require("fs");
const path = require("path");

async function run() {
  console.log("🚀 Starting Emergency Render (CJS)...");
  const taskPath = path.join(__dirname, "../.tmp/force_render/task.json");

  if (!fs.existsSync(taskPath)) {
    console.error("❌ Task file missing at: " + taskPath);
    process.exit(1);
  }

  const task = JSON.parse(fs.readFileSync(taskPath, "utf8"));

  const outPath = path.join(__dirname, "../.tmp/REVEAL_CYBER_GENE.mp4");

  try {
    // We override assets to use web URLs for this preview to ensure they load
    const spec = {
      ...task.renderSpec,
      assets: {
        ...task.renderSpec.assets,
        hero_bg: "https://r2.hyperframes.com/temp/hero.png",
        dashboard: "https://r2.hyperframes.com/temp/dashboard.png",
        gsap: "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js",
      },
    };

    await renderVideo({
      spec: spec,
      outPath: outPath,
    });
    console.log("✅ SUCCESS! Video created at: " + outPath);
  } catch (err) {
    console.error("❌ Render failed:", err);
  }
}

run();
