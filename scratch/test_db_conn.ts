import postgres from "postgres";

async function testConnection() {
  const databaseUrl =
    "postgresql://postgres.scrjkqejdxectzncsoik:%2BWeA42q%25qCVkR%23k@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

  console.log("Connecting to database...");
  const sql = postgres(databaseUrl, {
    prepare: false,
    connect_timeout: 10,
  });

  try {
    const result = await sql`SELECT NOW()`;
    console.log("✅ Successfully connected to database!");
    console.log("Current time from DB:", result[0].now);

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'worker_task'
    `;

    if (tables.length > 0) {
      console.log('✅ Table "worker_task" exists!');

      const stats = await sql`
        SELECT status, count(*) as count 
        FROM worker_task 
        GROUP BY status
      `;
      console.log("Current queue stats:", stats);
    } else {
      console.log('❌ Table "worker_task" NOT found in public schema!');
    }
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
  } finally {
    await sql.end();
  }
}

testConnection();
