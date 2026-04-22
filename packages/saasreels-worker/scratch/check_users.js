import pkg from "pg";
const { Client } = pkg;

const databaseUrl =
  "postgresql://postgres.xlfhzzgjzoulousdpiiz:mPL0pG4FBdgf8mM@@aws-1-us-west-2.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const res = await client.query('SELECT id, email, name FROM "user" LIMIT 5');
    console.log(JSON.stringify(res.rows, null, 2));
  } finally {
    await client.end();
  }
}

run().catch(console.error);
