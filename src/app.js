import "dotenv/config";
import express from "express";
import apiRouter from "./routes/api.js";
import { ApiError } from "./utils/errors.js";
import { errorResponse } from "./utils/responses.js";

const app = express();
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "https://saku-pas.vercel.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const untrimmedPasswordFields = new Set([
  "current_password",
  "password",
  "password_confirmation",
  "password_current",
  "password_new",
]);

function normalizeInput(value, key = undefined) {
  if (typeof value === "string") {
    if (untrimmedPasswordFields.has(key)) return value === "" ? null : value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeInput(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [field, normalizeInput(item, field)]),
    );
  }
  return value;
}

app.disable("x-powered-by");
app.use((request, response, next) => {
  const origin = request.get("origin");
  if (origin && allowedOrigins.has(origin)) {
    response.set("Access-Control-Allow-Origin", origin);
    response.set("Vary", "Origin");
    response.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  }
  if (request.method === "OPTIONS") return response.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
  return next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use((request, response, next) => {
  if (request.body !== undefined) request.body = normalizeInput(request.body);
  return next();
});

app.get("/up", (request, response) => response.json({ healthy: true }));
app.use("/api/v1", apiRouter);

app.use((request, response) => response.status(404).json({ message: "Not Found." }));
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  if (error instanceof ApiError) {
    if (error.validation) {
      return response.status(error.status).json({
        message: error.message,
        errors: error.errors,
      });
    }
    if (error.standardResponse) {
      return response.status(error.status).json({ message: error.message });
    }
    return errorResponse(response, error.message, error.status, error.errors);
  }
  if (error?.code === "23505" && error?.constraint === "users_email_unique") {
    return response.status(422).json({
      message: "The given data was invalid.",
      errors: { email: ["The email has already been taken."] },
    });
  }
  if (error?.type === "entity.parse.failed") {
    return errorResponse(response, "The request body contains invalid JSON.", 400);
  }
  console.error("Unhandled request error:", {
    method: request.method,
    path: request.path,
    name: error?.name || "Error",
    code: error?.code,
  });
  return response.status(500).json({ message: "Server Error." });
});

export default app;
