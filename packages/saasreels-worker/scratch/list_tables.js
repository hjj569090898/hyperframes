import pkg from "pg";
const { Client } = pkg;

const databaseUrl =
  "postgresql://postgres.xlfhzzgjzoulousdpiiz:mPL0pG4FBdgf8mM@@aws-1-us-west-2.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(res.rows.map((r) => r.table_name).join(", "));
  } finally {
    await client.end();
  }
}

run().catch(console.error);
