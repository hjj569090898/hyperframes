import pkg from "pg";
const { Pool } = pkg;
import { readFile, readdir } from "node:fs/promises";
import { AwsClient } from "aws4fetch";
import dotenv from "dotenv";
import path from "path";
import { randomUUID } from "crypto";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY,
  secretAccessKey: process.env.R2_SECRET_KEY,
  bucket: process.env.R2_BUCKET_NAME,
  publicDomain: process.env.R2_DOMAIN,
};

const client = new AwsClient({
  accessKeyId: config.accessKeyId,
  secretAccessKey: config.secretAccessKey,
  region: "auto",
});

async function uploadFile(filePath, key) {
  const body = await readFile(filePath);
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${config.bucket}/${key}`;
  const contentType = filePath.endsWith(".mp4") ? "video/mp4" : "image/png";

  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return `${config.publicDomain}/${key}`;
}

async function sync() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const projectId = "v7fjdRao_jeJKdQFhjs6i";
  const assetDir =
    "d:/toTheSea/hyperframes/packages/saasreels-worker/assets/v7fjdRao_jeJKdQFhjs6i_ineedprompt";

  const assetMapping = {
    "showcases.png": { role: "hero", desc: "Premium AI image gallery showcase" },
    "demo-video.mp4": { role: "product_demo", desc: "Direct operation of the prompt editor" },
    "功能区域.png": { role: "feature_explanation", desc: "Editor core modes and shortcuts" },
    "price.png": { role: "social_proof", desc: "Pricing and credits system" },
    "案例区域.png": { role: "gallery", desc: "Rich scene formula examples" },
  };

  try {
    console.log("--- Starting Sync for INeedPrompt ---");
    await pool.query("BEGIN");

    // 1. Sync Intents
    console.log("Syncing Intents...");
    const intents = {
      slogan: "AI Prompts powered by INeedPrompt - Easy to use and fast to ship.",
      mustIncludePoints: [
        "Dual Generation Modes: Supplement professional prompts or Generate from scratch.",
        "Smart Workflow: Shortcut-driven UI with Ctrl+C/I/G for rapid prompt iterative design.",
        "Creative Freedom: Input your concept, AI handles tech scene formulas and rich details.",
      ],
    };
    await pool.query(
      "INSERT INTO project_generation_intents (id, project_id, slogan, must_include_points, status) VALUES ($1, $2, $3, $4, $5)",
      [
        "int_" + randomUUID().slice(0, 8),
        projectId,
        intents.slogan,
        JSON.stringify(intents.mustIncludePoints),
        "completed",
      ],
    );

    // 2. Upload Assets & Sync
    console.log("Uploading and Syncing Assets...");
    const files = await readdir(assetDir);
    for (const file of files) {
      if (assetMapping[file]) {
        const key = `assets/${projectId}/${file}`;
        const localPath = path.join(assetDir, file);
        console.log(`Uploading ${file}...`);
        const r2Url = await uploadFile(localPath, key);

        await pool.query(
          "INSERT INTO project_assets (id, project_id, type, r2_url, user_description, intended_role) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            "ast_" + randomUUID().slice(0, 8),
            projectId,
            file.endsWith(".mp4") ? "video" : "image",
            r2Url,
            assetMapping[file].desc,
            assetMapping[file].role,
          ],
        );
      }
    }

    await pool.query("COMMIT");
    console.log("--- Sync Completed Successfully ---");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Sync failed:", err);
  } finally {
    await pool.end();
  }
}

sync();
