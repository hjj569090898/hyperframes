import dotenv from "dotenv";
import { CinematicDirector } from "../src/director.js";

dotenv.config();

async function testScriptOnly() {
  const director = new CinematicDirector({
    apiKey: process.env.KIMI_API_KEY || "",
    model: process.env.KIMI_MODEL || "moonshot-v1-8k-vision-preview",
    endpoint: process.env.KIMI_ENDPOINT || "https://api.moonshot.cn/v1/chat/completions",
  });

  const context = {
    sourceUrl: "https://www.ineed-prompt.com",
    projectId: "audit_test_001",
    templateId: "cinematic-v1",
    intents: {
      slogan: "Stop manual prompt engineering. Start creating.",
      mustIncludePoints: ["AI-powered suggestions", "100+ Free templates", "One-click export"],
    },
    assets: [
      {
        id: "img_hero",
        r2Url:
          "https://pub-450e3205f8b14bb88c2bc049525b32aa.r2.dev/assets/v7fjdRao_jeJKdQFhjs6i/showcases.png",
        type: "image",
        projectId: "test",
      },
      {
        id: "img_price",
        r2Url:
          "https://pub-450e3205f8b14bb88c2bc049525b32aa.r2.dev/assets/v7fjdRao_jeJKdQFhjs6i/price.png",
        type: "image",
        projectId: "test",
      },
      {
        id: "img_feature",
        r2Url:
          "https://pub-450e3205f8b14bb88c2bc049525b32aa.r2.dev/assets/v7fjdRao_jeJKdQFhjs6i/功能区域.png",
        type: "image",
        projectId: "test",
      },
    ],
  };

  console.log("--- 🕵️ AI Director Audit Start ---");
  try {
    const spec = await director.direct(context);
    console.log("--- ✅ Final Validated Spec ---");
    console.log(JSON.stringify(spec, null, 2));
    console.log("\nCheck packages/saasreels-worker/logs/ai_calls.log for full API trace.");
  } catch (e) {
    console.error("Audit failed:", e);
  }
}

testScriptOnly();
