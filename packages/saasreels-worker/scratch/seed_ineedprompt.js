import pkg from "pg";
const { Client } = pkg;
import { randomUUID } from "crypto";

const databaseUrl =
  "postgresql://postgres.xlfhzzgjzoulousdpiiz:mPL0pG4FBdgf8mM@@aws-1-us-west-2.pooler.supabase.com:6543/postgres";
const userId = "9c3469d7-a571-4ec1-a329-7e0573a92d15";

const heroBgPath =
  "C:\\Users\\801611\\.gemini\\antigravity\\brain\\3dc10894-7a92-4733-943a-8c6b3e2a3cb2\\ineedprompt_hero_bg_1776667648547.png";
const dashboardPath =
  "C:\\Users\\801611\\.gemini\\antigravity\\brain\\3dc10894-7a92-4733-943a-8c6b3e2a3cb2\\ineedprompt_dashboard_mockup_1776667669810.png";

const renderSpec = {
  fps: 30,
  format: "16:9",
  totalFrames: 300,
  scenes: [
    {
      durationFrames: 90,
      component: "HeroContent",
      mediaElementId: "hero_bg",
      params: { bgGlowColor: "rgba(0, 0, 50, 0.5)" },
      text: {
        content: "THINK IN CONCEPTS.\nTAB INTO RESULTS.",
        position: "center",
        style: "headline",
      },
    },
    {
      durationFrames: 120,
      component: "GenerativeDemo",
      mediaElementId: "dashboard",
      params: {},
      text: {
        content: "DUAL MODES: SUPPLEMENT & GENERATE\nSmart Autocomplete for Pro Prompts.",
        position: "bottom",
        style: "subhead",
      },
    },
    {
      durationFrames: 90,
      component: "HeroContent",
      mediaElementId: "hero_bg",
      params: {},
      text: {
        content: "STOP WRITING PROMPTS.\nSTART DESIGNING THEM.",
        position: "center",
        style: "headline",
      },
    },
  ],
  assets: {
    hero_bg: "file://" + heroBgPath,
    dashboard: "file://" + dashboardPath,
    gsap: "file://D:/toTheSea/hyperframes/packages/saasreels-worker/gsap.min.js",
  },
};

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    const projectId = "proj_" + randomUUID().slice(0, 8);
    const versionId = "ver_" + randomUUID().slice(0, 8);
    const taskId = "task_" + randomUUID().slice(0, 8);

    console.log(`Seeding project ${projectId}...`);

    await client.query(
      "INSERT INTO video_project (id, user_id, title, source_url, status) VALUES ($1, $2, $3, $4, $5)",
      [projectId, userId, "INeedPrompt Demo", "https://www.ineed-prompt.com/", "active"],
    );

    await client.query(
      "INSERT INTO video_version (id, project_id, version_number, title, render_spec, schema_version, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        versionId,
        projectId,
        1,
        "Initial AI Direction",
        JSON.stringify(renderSpec),
        "1.0.0",
        "draft",
      ],
    );

    const intents = {
      slogan: "Stop Writing Prompts. Start Designing Them.",
      mustIncludePoints: [
        "Dual Generation Modes (Supplement & Generate)",
        "Universal Model Support",
        "Chrome Extension Support",
        "Context-Aware AI",
      ],
    };
    await client.query(
      "INSERT INTO project_generation_intents (id, project_id, slogan, must_include_points, status) VALUES ($1, $2, $3, $4, $5)",
      [
        "int_" + randomUUID().slice(0, 8),
        projectId,
        intents.slogan,
        JSON.stringify(intents.mustIncludePoints),
        "completed",
      ],
    );

    const payload = {
      ...renderSpec,
      projectId,
      versionId,
      sourceUrl: "https://www.ineed-prompt.com/",
    };

    await client.query(
      "INSERT INTO worker_task (id, kind, status, payload, priority) VALUES ($1, $2, $3, $4, $5)",
      [taskId, "generate_video", "queued", JSON.stringify(payload), 10],
    );

    await client.query("COMMIT");

    console.log(`Successfully seeded task ${taskId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

run().catch(console.error);
