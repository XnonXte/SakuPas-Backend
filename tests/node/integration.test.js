import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";

const isolatedDatabaseConfirmed = process.env.TEST_DATABASE_URL
  && process.env.TEST_DATABASE_NAME
  && process.env.ALLOW_TEST_DATABASE_WRITES === "I_UNDERSTAND_THIS_IS_AN_ISOLATED_TEST_DATABASE";

test("registration, legacy bcrypt login, bearer auth, and logout work with PostgreSQL", {
  skip: !isolatedDatabaseConfirmed,
}, async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.DB_SSLMODE ||= "require";
  const { default: app } = await import("../../src/app.js");
  const { pool } = await import("../../src/config/database.js");
  const bcryptModule = await import("bcryptjs");
  const bcrypt = bcryptModule.default;
  const expectedDatabaseName = decodeURIComponent(process.env.TEST_DATABASE_NAME);
  const email = `node-migration-${randomUUID()}@example.test`;
  let userId;
  let databaseConfirmed = false;

  try {
    const identity = await pool.query("SELECT current_database() AS name");
    assert.equal(identity.rows[0].name, expectedDatabaseName, "test database name must match the explicit confirmation");
    databaseConfirmed = true;

    const registration = await request(app)
      .post("/api/v1/register")
      .send({
        name: "Migration Test",
        email,
        password: "A-temporary-test-password-42",
        password_confirmation: "A-temporary-test-password-42",
      });
    assert.equal(registration.status, 201);
    assert.ok(registration.body.data.token);
    userId = registration.body.data.user.id;

    const legacyStyleHash = (await bcrypt.hash("A-temporary-test-password-42", 4))
      .replace(/^\$2[ab]\$/, "$2y$");
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [legacyStyleHash, userId]);

    const login = await request(app)
      .post("/api/v1/login")
      .send({ email, password: "A-temporary-test-password-42" });
    assert.equal(login.status, 200);
    const token = login.body.data.token;

    const profile = await request(app)
      .get("/api/v1/user")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.email, email);

    const invalid = await request(app)
      .get("/api/v1/user")
      .set("Authorization", "Bearer 999999|invalid-token");
    assert.equal(invalid.status, 401);

    const logout = await request(app)
      .post("/api/v1/logout")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(logout.status, 200);

    const revoked = await request(app)
      .get("/api/v1/user")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(revoked.status, 401);
  } finally {
    if (databaseConfirmed) {
      if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      else await pool.query("DELETE FROM users WHERE email = $1", [email]);
    }
    await pool.end();
  }
});
