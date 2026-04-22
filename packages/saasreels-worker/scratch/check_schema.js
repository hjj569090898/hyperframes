import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'video_version'",
    );
    console.log("Columns in video_version:");
    console.table(res.rows);
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkSchema();
