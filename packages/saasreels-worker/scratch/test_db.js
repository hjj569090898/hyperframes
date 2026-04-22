import pkg from "pg";
const { Client } = pkg;

const databaseUrl =
  "postgresql://postgres.xlfhzzgjzoulousdpiiz:mPL0pG4FBdgf8mM@@aws-1-us-west-2.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  console.log("Connecting...");
  await client.connect();
  console.log("Connected.");
  try {
    const res = await client.query("SELECT 1 as result");
    console.log(res.rows);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("FAILED to connect or query:");
  console.error(err);
});
