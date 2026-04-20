import pg from "pg";

async function enqueue() {
  const connectionString =
    "postgresql://postgres.xlfhzzgjzoulousdpiiz:mPL0pG4FBdgf8mM@@aws-1-us-west-2.pooler.supabase.com:6543/postgres";
  const client = new pg.Client({ connectionString });

  const payload = {
    projectId: "p_narration_demo",
    versionId: "v_v1",
    fps: 30,
    format: "9:16",
    totalFrames: 120,
    globalAssets: {
      bgmId: "bgm_track",
      bgmVolume: 0.3, // 调低背景音，突出人声
    },
    assets: {
      img1: "https://picsum.photos/id/101/1080/1920.jpg",
      img2: "https://picsum.photos/id/102/1080/1920.jpg",
      bgm_track: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
      voice_scene_1: "https://www.w3schools.com/html/horse.mp3", // 模拟人声 1
      voice_scene_2: "https://www.w3schools.com/html/horse.mp3", // 模拟人声 2
    },
    scenes: [
      {
        durationFrames: 60,
        component: "HeroContent",
        mediaElementId: "img1",
        params: {},
        narration: { audioId: "voice_scene_1" },
        text: { content: "正在演示 AI 旁白功能", position: "center", style: "headline" },
      },
      {
        durationFrames: 60,
        component: "GenerativeDemo",
        mediaElementId: "img2",
        params: { bgGlowColor: "#059669" },
        narration: { audioId: "voice_scene_2" },
        text: { content: "音画同步，自动混流", position: "bottom", style: "subhead" },
      },
    ],
  };

  const id = "task_narration_test_" + Date.now();

  try {
    await client.connect();
    await client.query(
      `
      INSERT INTO worker_task (
        id, kind, status, payload, priority, attempts, max_attempts, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `,
      [id, "generate_video", "queued", JSON.stringify(payload), 10, 0, 3],
    );
    console.log("✅ Successfully enqueued Narration task:", id);
  } catch (err) {
    console.error("❌ Failed to enqueue task:", err);
  } finally {
    await client.end();
  }
}

enqueue();
