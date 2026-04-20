import type { PostgresQueryClient } from "./postgresQueue.js";

export type ProjectIntent = {
  slogan: string | null;
  mustIncludePoints: string[] | null;
  preferredAssetIds: string[] | null;
};

export type ProjectAsset = {
  id: string;
  type: string;
  r2Url: string;
  userDescription: string | null;
  intendedRole: string | null;
};

export async function fetchProjectIntents(
  client: PostgresQueryClient,
  projectId: string,
): Promise<ProjectIntent | null> {
  const query = `
    SELECT slogan, must_include_points, preferred_asset_ids
    FROM project_generation_intents
    WHERE project_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const result = await client.query<{
    slogan: string | null;
    must_include_points: string | null;
    preferred_asset_ids: string | null;
  }>(query, [projectId]);

  const row = result.rows[0];
  if (!row) return null;

  return {
    slogan: row.slogan,
    mustIncludePoints: row.must_include_points ? JSON.parse(row.must_include_points) : null,
    preferredAssetIds: row.preferred_asset_ids ? JSON.parse(row.preferred_asset_ids) : null,
  };
}

export async function fetchProjectAssets(
  client: PostgresQueryClient,
  projectId: string,
): Promise<ProjectAsset[]> {
  const query = `
    SELECT id, type, r2_url, user_description, intended_role
    FROM project_assets
    WHERE project_id = $1
    ORDER BY created_at ASC
  `;
  const result = await client.query<{
    id: string;
    type: string;
    r2_url: string;
    user_description: string | null;
    intended_role: string | null;
  }>(query, [projectId]);

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    r2Url: row.r2_url,
    userDescription: row.user_description,
    intendedRole: row.intended_role,
  }));
}
