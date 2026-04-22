import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkSpec() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(
      "SELECT id, render_spec FROM video_version WHERE id = 'vdebug_d4563a62'",
    );
    console.log("Render Spec for vdebug_d4563a62:");
    console.log(JSON.stringify(res.rows[0].render_spec, null, 2));
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkSpec();
