import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function updateUrl() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const projectId = "v7fjdRao_jeJKdQFhjs6i";
    const newUrl = "https://www.ineed-prompt.com/";

    console.log(`Updating project ${projectId} URL to ${newUrl}...`);
    await pool.query("UPDATE video_project SET source_url = $1, title = $2 WHERE id = $3", [
      newUrl,
      "INeedPrompt Video",
      projectId,
    ]);
    console.log("Update successful.");
  } catch (err) {
    console.error("Error updating DB:", err);
  } finally {
    await pool.end();
  }
}

updateUrl();
