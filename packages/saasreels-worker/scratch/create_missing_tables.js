import pkg from "pg";
const { Client } = pkg;

const databaseUrl =
  "postgresql://postgres.xlfhzzgjzoulousdpiiz:mPL0pG4FBdgf8mM@@aws-1-us-west-2.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    console.log("Creating missing tables...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES video_project(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        original_name TEXT,
        r2_url TEXT NOT NULL,
        user_description TEXT,
        intended_role TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS project_generation_intents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES video_project(id) ON DELETE CASCADE,
        slogan TEXT,
        must_include_points TEXT,
        preferred_asset_ids TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Tables created successfully.");
  } finally {
    await client.end();
  }
}

run().catch(console.error);
