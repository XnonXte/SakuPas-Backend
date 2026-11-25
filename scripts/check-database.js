import "dotenv/config";
import { pool } from "../src/config/database.js";

try {
  const result = await pool.query("SELECT 1 AS connected");
  if (result.rows[0].connected !== 1) throw new Error("Unexpected database probe result.");
  console.log("Neon PostgreSQL connectivity verified.");
} catch (error) {
  console.error("Database connectivity check failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
