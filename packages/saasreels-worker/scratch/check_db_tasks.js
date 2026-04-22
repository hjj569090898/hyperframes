import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkTasks() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(
      "SELECT id, kind, status, payload, created_at FROM worker_task ORDER BY created_at DESC LIMIT 10",
    );
    console.log("Recent tasks:");
    console.table(res.rows);

    const counts = await pool.query("SELECT status, count(*) FROM worker_task GROUP BY status");
    console.log("\nTask counts:");
    console.table(counts.rows);
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkTasks();
