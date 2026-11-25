# SakuPas Express deployment

The API is a Vercel Node.js function backed by PostgreSQL (Neon). It is stateless:
authentication uses the existing hashed bearer-token table, and uploaded
files, queue workers, and local sessions are not part of the current API.

## Local setup

Requirements: Node.js 20 or newer and access to a PostgreSQL database. Use a
dedicated development database, not the production Neon database.

```powershell
npm ci
Copy-Item .env.example .env.node
$env:DOTENV_CONFIG_PATH = '.env.node'
```

Set the database connection in `.env.node`, either with the individual `DB_*`
values or a `DATABASE_URL`. Keep `DB_SSLMODE=require` for Neon. Using `.env.node`
avoids overwriting a local `.env` file. Then run the schema migration only
against an isolated development database or after verifying that its schema
matches the existing application tables:

```powershell
npm run db:check
npm run db:migrate
npm test
npm start
```

The migration uses `CREATE TABLE IF NOT EXISTS`, adds indexes idempotently, and
never drops or resets tables. It does not import, transform, or overwrite data.
It is a separate operator command; deployment startup does not run migrations.
Back up the database and review its existing schema before running it.

In another PowerShell window:

```powershell
Invoke-RestMethod http://localhost:3000/up
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/v1/login `
  -ContentType 'application/json' `
  -Body '{"email":"your-test-user@example.com","password":"your-test-password"}'
```

To test a protected API route, capture the `token` from login and send it as a
bearer token:

```powershell
$token = '<token returned by login>'
Invoke-RestMethod http://localhost:3000/api/v1/user `
  -Headers @{ Authorization = "Bearer $token" }
```

Inspect runtime output in the terminal running `npm start`. The application does
not log request bodies, passwords, bearer tokens, or database credentials.

The PostgreSQL authentication integration test is opt-in and writes test records.
Run it only against a dedicated, disposable test database after applying the
migrations there:

```powershell
$env:TEST_DATABASE_URL = '<isolated-test-database-url>'
$env:TEST_DATABASE_NAME = '<expected-database-name>'
$env:ALLOW_TEST_DATABASE_WRITES = 'I_UNDERSTAND_THIS_IS_AN_ISOLATED_TEST_DATABASE'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm run test:integration
```

Never point this test at production. It creates a unique test user and removes
that user when complete.

## Vercel deployment

1. Provision/confirm a Neon PostgreSQL database. Keep existing tables and data;
   do not reset them. Use a separate database branch for migration testing.
2. Before production cutover, inspect the current database schema and verify it
   matches the schema definitions in `database/migrations/`. Run
   `npm run db:migrate` only if you have reviewed the additive migration and have
   a current backup. Do not run it as part of application startup.
3. Import this repository into Vercel and set the project root to the repository
   root. Vercel's Express framework support discovers the default Express app
   export in `src/app.js` and serves it as a function. `vercel.json` keeps the
   official configuration schema without overriding Express routing.
4. Configure the environment variables below for **Production**, and add Preview
   values separately if previews use a separate Neon branch.
5. Deploy. Verify `/up`, login, an authenticated profile request, and the
   frontend's protected endpoints. Inspect Vercel Function logs if a request
   fails.
6. Deploy the frontend with its existing API base URL pointing to this project's
   domain if that is not already configured. CORS allows
   `https://saku-pas.vercel.app` by default.

## Vercel environment variables

Required:

- `DB_HOST`
- `DB_PORT` (normally `5432`)
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_SSLMODE=require`

Alternatively, provide `DATABASE_URL` instead of the individual database fields.
Use Vercel's encrypted environment-variable settings; never commit credentials.

Optional:

- `DB_POOL_MAX` (default `5`; tune to Neon connection limits)
- `CORS_ORIGINS` (default `https://saku-pas.vercel.app`, comma-separated exact origins)
- `TOKEN_EXPIRATION_MINUTES` (default `0`, meaning tokens do not expire)
- `NODE_ENV=production`

## Common deployment issues

- **Database connection refused / timeout:** confirm Neon host, credentials,
  database name, SSL mode, and Vercel environment scope. Run `npm run db:check`
  locally with the same non-production connection details.
- **Too many connections:** lower `DB_POOL_MAX` and use Neon pooling where
  appropriate. Do not create a new pool for each request.
- **401 on protected routes:** send the current token exactly as
  `Authorization: Bearer <token>`. Invalid, expired, or logged-out tokens return
  401 JSON.
- **CORS error:** set the exact frontend origin in `CORS_ORIGINS`, without a
  trailing slash. Only the configured origins are allowed.
- **Missing tables:** compare the Neon schema with the SQL definitions and
  apply the additive Node migration only after a backup and explicit review.
- **Function timeout:** HTTP requests perform synchronous API work only. Do not
  run queue workers or migrations inside a request or at function startup.

See [API.md](./API.md) for all route paths and methods.
