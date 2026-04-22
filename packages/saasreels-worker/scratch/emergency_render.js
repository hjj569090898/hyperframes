import pkg from "pg";
const { Pool } = pkg;
import { CinematicDirector } from "../src/director.js";
import { translateRenderSpecToHtml } from "../src/translate.js";
import { createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import dotenv from "dotenv";
import { fetchProjectAssets, fetchProjectIntents } from "../src/db.js";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function emergency() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const projectId = "v7fjdRao_jeJKdQFhjs6i";
  const taskId = "emergency_soulful_7_" + Date.now();
  const workspaceDir = resolve(`.tmp/saasreels-worker/${taskId}`);

  try {
    console.log("--- Emergency Rendering Initiated ---");

    // 1. Fetch Context
    const intents = await fetchProjectIntents(pool, projectId);
    const assets = await fetchProjectAssets(pool, projectId);

    // 2. Direct (Real Dual-Agent AI)
    const director = new CinematicDirector({
      apiKey: process.env.KIMI_API_KEY,
      model: process.env.KIMI_MODEL,
      endpoint: process.env.KIMI_ENDPOINT,
    });
    const spec = await director.direct({
      sourceUrl: "https://www.ineed-prompt.com/",
      projectId,
      templateId: "marketing-v1",
      intents,
      assets,
    });

    // 3. Materialize
    await mkdir(workspaceDir, { recursive: true });
    const html = translateRenderSpecToHtml(spec);
    await writeFile(join(workspaceDir, "index.html"), html);
    await writeFile(join(workspaceDir, "task.json"), JSON.stringify(spec, null, 2));

    // Copy gsap.js
    const gsapPath = resolve("packages/saasreels-worker/assets/gsap.js");
    await copyFile(gsapPath, join(workspaceDir, "gsap.js"));

    // Download/Link assets
    const cacheDir = resolve(".tmp/saasreels-worker/cache");
    await mkdir(cacheDir, { recursive: true });
    for (const [id, url] of Object.entries(spec.assets)) {
      let attempts = 0;
      let success = false;
      while (attempts < 3 && !success) {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await response.arrayBuffer();
          const ext = url.split("?")[0].split(".").pop();
          const target = join(workspaceDir, `${id}.${ext}`);
          await writeFile(target, Buffer.from(buffer));
          console.log(`Downloaded ${id} (Attempt ${attempts + 1})`);
          success = true;
        } catch (err) {
          attempts++;
          console.warn(`Failed to download ${id}, retrying... (${attempts}/3)`, err.message);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // 4. Render
    const outputPath = join(workspaceDir, "output.mp4");
    const job = createRenderJob({
      input: join(workspaceDir, "index.html"),
      output: outputPath,
      width: 1920,
      height: 1080,
      fps: 30,
      workers: 1,
    });

    console.log("Rendering video...");
    await executeRenderJob(job, workspaceDir, outputPath);

    // 5. Upload
    console.log("Uploading to R2...");
    const { R2Storage } = await import("../src/storage.js");
    const storage = new R2Storage({
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
      bucket: process.env.R2_BUCKET_NAME,
      publicDomain: process.env.R2_DOMAIN,
    });
    const videoUrl = await storage.uploadVideo(outputPath, `emergencies/${taskId}.mp4`);

    console.log("--- EMERGENCY COMPLETE ---");
    console.log("Result URL:", videoUrl);
  } catch (err) {
    console.error("Emergency failed:", err);
  } finally {
    await pool.end();
  }
}

emergency();
