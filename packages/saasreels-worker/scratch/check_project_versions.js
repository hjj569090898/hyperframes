import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function checkProject() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const projectId = "v7fjdRao_jeJKdQFhjs6i";
    console.log(`Checking project ${projectId}...`);

    const versions = await pool.query(
      "SELECT id, version_number, status, created_at FROM video_version WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId],
    );
    console.log("\nVersions:");
    console.table(versions.rows);
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    await pool.end();
  }
}

checkProject();
