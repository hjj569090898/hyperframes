import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkTasks() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(
      "SELECT id, kind, status, payload, created_at FROM worker_task WHERE status = 'queued' ORDER BY created_at DESC",
    );
    console.log("Queued tasks:");
    res.rows.forEach((r) => {
      console.log(`ID: ${r.id}, Payload: ${r.payload}`);
    });
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkTasks();
