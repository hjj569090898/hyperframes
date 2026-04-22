import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import { randomUUID } from "crypto";

dotenv.config({ path: "d:/toTheSea/hyperframes/.env" });

async function repairTask() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const taskId = "DzHiXlwmiynljxTH_Lt9j";
    const projectId = "v7fjdRao_jeJKdQFhjs6i";
    const versionId = "vdebug_" + randomUUID().slice(0, 8);

    console.log(`Repairing task ${taskId} for project ${projectId}...`);

    await pool.query("BEGIN");

    // 1. Create a dummy video_version if it doesn't exist
    const versionExists = await pool.query("SELECT id FROM video_version WHERE id = $1", [
      versionId,
    ]);
    if (versionExists.rows.length === 0) {
      console.log(`Creating video_version ${versionId}...`);
      await pool.query(
        "INSERT INTO video_version (id, project_id, version_number, title, status, schema_version, render_spec) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          versionId,
          projectId,
          1,
          "Debug Version",
          "draft",
          "1.0.0",
          JSON.stringify({ scenes: [] }),
        ],
      );
    }

    // 2. Update task payload to include versionId and reset status to queued
    const payload = {
      projectId,
      versionId,
      sourceUrl: "https://www.ineed-prompt.com/",
      templateId: "marketing-v1",
    };

    console.log(`Updating task ${taskId} payload and resetting status to queued...`);
    await pool.query(
      "UPDATE worker_task SET payload = $1, status = 'queued', claimed_by = NULL, claimed_at = NULL, last_error = NULL WHERE id = $2",
      [JSON.stringify(payload), taskId],
    );

    await pool.query("COMMIT");
    console.log("Repair completed successfully.");
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error repairing task:", err);
  } finally {
    await pool.end();
  }
}

repairTask();
