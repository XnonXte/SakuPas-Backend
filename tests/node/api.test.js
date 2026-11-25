import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import request from "supertest";
import app from "../../src/app.js";
import { pool } from "../../src/config/database.js";

test("health endpoint responds without requiring a database", async () => {
  const response = await request(app).get("/up");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { healthy: true });
});

test("protected API requests without a token return JSON 401", async () => {
  const response = await request(app).get("/api/v1/budgets");
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Unauthenticated." });
  assert.match(response.headers["content-type"], /application\/json/);
});

test("invalid bearer tokens return JSON 401", async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [], rowCount: 0 });

  try {
    const response = await request(app)
      .get("/api/v1/budgets")
      .set("Authorization", "Bearer 123|not-a-real-token");
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { message: "Unauthenticated." });
  } finally {
    pool.query = originalQuery;
  }
});

test("invalid login input uses the existing validation JSON format", async () => {
  const response = await request(app)
    .post("/api/v1/login")
    .send({ email: "not-an-email", password: "" });
  assert.equal(response.status, 422);
  assert.equal(response.body.message, "The given data was invalid.");
  assert.deepEqual(Object.keys(response.body.errors).sort(), ["email", "password"]);
});

test("registration validation runs before any database access", async () => {
  const response = await request(app)
    .post("/api/v1/register")
    .send({ name: "   ", email: " ", password: "short", password_confirmation: "different" });
  assert.equal(response.status, 422);
  assert.deepEqual(Object.keys(response.body.errors).sort(), ["email", "name", "password"]);
});

test("CORS allows the deployed frontend and rejects other origins", async () => {
  const allowed = await request(app)
    .options("/api/v1/login")
    .set("Origin", "https://saku-pas.vercel.app")
    .set("Access-Control-Request-Method", "POST");
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers["access-control-allow-origin"], "https://saku-pas.vercel.app");
  assert.match(allowed.headers["access-control-allow-headers"], /Authorization/i);

  const rejected = await request(app)
    .options("/api/v1/login")
    .set("Origin", "https://example.invalid")
    .set("Access-Control-Request-Method", "POST");
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers["access-control-allow-origin"], undefined);
});

test("unknown routes return JSON 404 without a redirect", async () => {
  const response = await request(app).get("/api/v1/not-a-route");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "Not Found." });
});

test("all legacy protected API routes are registered", async () => {
  const protectedRoutes = [
    ["POST", "/api/v1/logout"],
    ["GET", "/api/v1/user"],
    ["PUT", "/api/v1/user"],
    ["GET", "/api/v1/dashboard"],
    ["GET", "/api/v1/dashboard/cash-flow"],
    ["GET", "/api/v1/dashboard/expense-distribution"],
    ["GET", "/api/v1/dashboard/safe-to-spend"],
    ["GET", "/api/v1/accounts"],
    ["POST", "/api/v1/accounts"],
    ["GET", "/api/v1/accounts/1"],
    ["PUT", "/api/v1/accounts/1"],
    ["PATCH", "/api/v1/accounts/1"],
    ["DELETE", "/api/v1/accounts/1"],
    ["GET", "/api/v1/categories"],
    ["POST", "/api/v1/categories"],
    ["DELETE", "/api/v1/categories/1"],
    ["GET", "/api/v1/transactions"],
    ["POST", "/api/v1/transactions"],
    ["GET", "/api/v1/transactions/1"],
    ["PUT", "/api/v1/transactions/1"],
    ["PATCH", "/api/v1/transactions/1"],
    ["DELETE", "/api/v1/transactions/1"],
    ["GET", "/api/v1/paylater"],
    ["POST", "/api/v1/paylater"],
    ["GET", "/api/v1/paylater/1"],
    ["PUT", "/api/v1/paylater/1"],
    ["DELETE", "/api/v1/paylater/1"],
    ["POST", "/api/v1/paylater/1/toggle-paid"],
    ["GET", "/api/v1/paylater/1/repayments"],
    ["POST", "/api/v1/paylater/1/repayments"],
    ["GET", "/api/v1/budgets"],
    ["POST", "/api/v1/budgets"],
    ["DELETE", "/api/v1/budgets/1"],
    ["GET", "/api/v1/mode-hemat"],
    ["POST", "/api/v1/mode-hemat/activate"],
    ["POST", "/api/v1/mode-hemat/deactivate"],
  ];

  assert.equal(protectedRoutes.length, 36);
  for (const [method, path] of protectedRoutes) {
    const response = await request(app)[method.toLowerCase()](path);
    assert.equal(response.status, 401, `${method} ${path} should be registered and protected`);
  }
});

test("database migrations do not contain destructive data or schema operations", async () => {
  const migrationNames = [
    "001_initial_schema.sql",
    "002_system_categories.sql",
  ];
  for (const migrationName of migrationNames) {
    const sql = await readFile(
      new URL(`../../database/migrations/${migrationName}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE|UPDATE)\s/im);
  }
});
