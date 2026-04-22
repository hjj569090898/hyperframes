import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkTaskResult() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const taskId = "DzHiXlwmiynljxTH_Lt9j";
    const res = await pool.query("SELECT result FROM worker_task WHERE id = $1", [taskId]);
    console.log("Task Result Details:");
    console.log(JSON.stringify(JSON.parse(res.rows[0].result), null, 2));
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkTaskResult();
