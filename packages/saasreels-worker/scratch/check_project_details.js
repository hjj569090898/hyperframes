import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkProjectDetails() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const projectId = "v7fjdRao_jeJKdQFhjs6i";
    const res = await pool.query("SELECT * FROM video_project WHERE id = $1", [projectId]);
    console.log("Project Details:");
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkProjectDetails();
