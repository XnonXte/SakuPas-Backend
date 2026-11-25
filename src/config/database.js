import pg from "pg";

const { Pool, types } = pg;

types.setTypeParser(20, (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
});

const sslMode = process.env.DB_SSLMODE || "require";
const ssl = sslMode === "disable"
  ? false
  : { rejectUnauthorized: sslMode !== "require" };

const options = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_DATABASE || "neondb",
      user: process.env.DB_USERNAME || "neondb_owner",
      password: process.env.DB_PASSWORD,
    };

export const pool = globalThis.__sakupasPgPool || new Pool({
  ...options,
  ssl,
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

globalThis.__sakupasPgPool = pool;

export async function inTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
