import pkg from "pg";
const { Pool } = pkg;
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function uploadResult() {
  const taskId = "emergency_soulful_7_1776752566490";
  const outputPath = resolve(`.tmp/saasreels-worker/${taskId}/output.mp4`);

  console.log("Final Uploading to R2...");
  const { R2Storage } = await import("../src/storage.js");
  const storage = new R2Storage({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    publicDomain: process.env.R2_DOMAIN,
  });
  let attempts = 0;
  let success = false;
  let videoUrl = "";
  while (attempts < 5 && !success) {
    try {
      videoUrl = await storage.uploadVideo(outputPath, `final_victory/${taskId}.mp4`);
      success = true;
      console.log("--- FINAL VICTORY COMPLETE ---");
      console.log("Result URL:", videoUrl);
    } catch (err) {
      attempts++;
      console.warn(`Upload failed, retrying... (${attempts}/5)`, err.message);
      await new Promise((r) => setTimeout(r, 2000 * attempts));
    }
  }

  if (!success) throw new Error("Failed to upload after 5 attempts");
}

uploadResult();
