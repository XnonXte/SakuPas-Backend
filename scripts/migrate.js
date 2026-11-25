import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { pool } from "../src/config/database.js";

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS node_migrations (
      migration VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationDirectory = new URL("../database/migrations/", import.meta.url);
  const migrations = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  for (const migrationName of migrations) {
    const found = await pool.query(
      "SELECT 1 FROM node_migrations WHERE migration = $1",
      [migrationName],
    );
    if (found.rowCount) continue;

    const sql = await readFile(new URL(migrationName, migrationDirectory), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO node_migrations (migration) VALUES ($1)", [migrationName]);
      await client.query("COMMIT");
      console.log(`Applied ${migrationName}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  console.log("Database migrations are up to date.");
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
