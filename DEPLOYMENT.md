# Vercel container deployment

This project uses the Vercel Container Runtime with FrankenPHP/Caddy. The image
builds the existing Vite assets and installs production-only Composer
dependencies. It does not generate Laravel configuration caches or run database
migrations at startup.

## Requirements and application notes

- Laravel 13.17 requires PHP `^8.3`; the image uses PHP 8.4.
- The image includes `pdo_mysql` and `pdo_pgsql`. Use an external MySQL/MariaDB
  or PostgreSQL database and select the matching `DB_CONNECTION`.
- The existing `/up` route is Laravel's health endpoint. No new health route is
  needed.
- Caddy's document root is `/app/public`; Laravel source/config files stay
  outside the served root, and dotfile requests are rejected.
- API authentication uses Sanctum bearer tokens. There are no queued jobs,
  scheduled tasks, upload calls, or application cache/session calls in the
  current controllers and services.
- Database cache is shared through the configured external database. Sessions
  use the in-memory `array` driver; do not add server-side session-based
  features without switching to a shared store such as Redis.
- The HTTP container does not run queue workers or the Laravel scheduler.
  `QUEUE_CONNECTION=sync` is appropriate for the current app, which has no
  queued jobs. Use an external queue and a separately operated worker if
  asynchronous jobs are introduced. Trigger scheduled work with Vercel Cron or
  another external scheduler.
- Container files are ephemeral. There are no upload/storage calls today. If
  uploads are added, configure an external object store (and its Laravel
  filesystem adapter) rather than the local disk.
- `routes/web.php` optionally serves a sibling `../frontend` folder, but that
  folder is not in this repository. The container therefore serves Laravel's
  existing welcome fallback at `/`; the sibling frontend assets and three
  corresponding `WebFrontendTest` expectations are unavailable in this build
  context. The API routes and `/up` health route remain available.
- There is no npm lockfile, so the asset stage runs `npm install` against
  `package.json`. Add and commit a lockfile if deterministic JavaScript
  dependency resolution is required.

## Environment variables

Set these in Vercel for Production and any Preview environments that need
database-backed API requests:

| Variable | Required | Value |
| --- | --- | --- |
| `APP_KEY` | Yes | Stable Laravel key generated once per environment, e.g. `php artisan key:generate --show`. Keep it secret. |
| `APP_ENV` | Yes | `production` |
| `APP_DEBUG` | Yes | `false` |
| `APP_URL` | Yes | Public deployment URL, including `https://` |
| `DB_CONNECTION` | Yes | `mysql` / `mariadb` or `pgsql` |
| `DB_HOST` | Yes, unless using `DB_URL` | External database hostname |
| `DB_PORT` | Yes, unless using `DB_URL` | `3306` for MySQL/MariaDB or `5432` for PostgreSQL |
| `DB_DATABASE` | Yes, unless using `DB_URL` | Database name |
| `DB_USERNAME` | Yes, unless using `DB_URL` | Database user |
| `DB_PASSWORD` | Yes, unless using `DB_URL` | Database password |
| `LOG_CHANNEL` | Recommended | `stderr` (also the image default) |
| `CACHE_STORE` | Recommended | `database` (also the image default; requires migrations) |
| `SESSION_DRIVER` | Recommended | `array` (also the image default; use a shared store if sessions are added) |
| `QUEUE_CONNECTION` | Recommended | `sync` (also the image default; no asynchronous worker is run) |
| `FILESYSTEM_DISK` | Current app | `local`; no current code persists uploads. Set up an external object store before changing this. |

Use the database provider's TLS options if required. The Laravel configuration
supports `DB_URL`; alternatively provide the individual `DB_*` fields above.
Do not set `APP_DEBUG=true` in production and do not commit `.env` files.
Vercel supplies `PORT` at runtime; Caddy uses it and defaults to port 80 for
local Docker runs.

## Build and run locally (PowerShell)

From the repository root, build the image:

```powershell
docker build -t sakupas-backend .
```

Generate a local key with `php artisan key:generate --show`, then create a
local-only `.env.docker` file. For a database running on the host, use
`host.docker.internal` as `DB_HOST`:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:<generated-key>
APP_URL=http://localhost:8080
DB_CONNECTION=mysql
DB_HOST=host.docker.internal
DB_PORT=3306
DB_DATABASE=sakupas
DB_USERNAME=<database-user>
DB_PASSWORD=<database-password>
LOG_CHANNEL=stderr
CACHE_STORE=database
SESSION_DRIVER=array
QUEUE_CONNECTION=sync
```

Replace the placeholders with real local-only values. Do not put this file in
the Docker image or commit it.

Run the container:

```powershell
docker run --rm --name sakupas-backend --env-file .env.docker -p 8080:80 sakupas-backend
```

In another PowerShell window, check the framework health endpoint:

```powershell
curl.exe --fail http://localhost:8080/up
```

Check that an existing protected API endpoint is reachable. Without a token,
`401` is expected and confirms the existing Sanctum middleware still applies:

```powershell
curl.exe -i http://localhost:8080/api/v1/user
```

For an authenticated request, use a real token created by the existing login
flow:

```powershell
curl.exe -i http://localhost:8080/api/v1/user -H "Authorization: Bearer <TOKEN>"
```

Inspect runtime logs:

```powershell
docker logs sakupas-backend
```

Stop the container with `Ctrl+C` in its running terminal.

Run the API/auth feature tests with the test files present in this repository:

```powershell
php artisan test tests/Feature/AuthTest.php tests/Feature/BudgetTest.php tests/Feature/DashboardTest.php tests/Feature/ModeHematTest.php tests/Feature/PayLaterTest.php tests/Feature/TransactionTest.php
```

The canonical complete suite command is:

```powershell
composer test
```

The current full suite has three pre-existing failures in `WebFrontendTest`
because the sibling `frontend/` directory is absent.

## Database migrations

Migrations are a separate operation. Provision an external database per
environment, then run migrations once before sending database-backed traffic
to that environment. After linking the local project with `vercel link`, run
the migration container with the matching Vercel environment:

```powershell
vercel env run --environment=production -- docker run --rm `
  -e APP_KEY -e APP_ENV -e APP_DEBUG -e APP_URL `
  -e DB_CONNECTION -e DB_URL -e DB_HOST -e DB_PORT -e DB_DATABASE `
  -e DB_USERNAME -e DB_PASSWORD -e DB_SSLMODE -e MYSQL_ATTR_SSL_CA `
  -e LOG_CHANNEL -e CACHE_STORE -e SESSION_DRIVER -e QUEUE_CONNECTION `
  sakupas-backend php artisan migrate --force
```

For Preview, use `vercel env run --environment=preview --` with the same Docker
command and the matching Preview database. Keep Preview and Production keys/data
isolated.

Do not run migrations from the image build or container startup; Vercel may
start multiple instances concurrently.

## Deploy to Vercel

1. Push this repository to the Git provider connected to Vercel, or install,
   authenticate, and link the Vercel CLI with `vercel link`.
2. In Vercel, create/import a project with this repository root as the project
   root. Keep `Dockerfile`, `Caddyfile`, and `vercel.json` at that root.
3. Provision a production external MySQL/MariaDB or PostgreSQL database that
   accepts connections from Vercel. Add the environment variables listed
   above in **Project Settings → Environment Variables**. Add the same
   `APP_KEY` and database settings to the appropriate Preview environment when
   needed; keep production and preview keys/data isolated.
4. Generate `APP_KEY` once with `php artisan key:generate --show` and add the
   result to Vercel as a secret environment variable. Keep the same key across
   redeployments of that environment.
5. Deploy a Preview first with `vercel deploy`, or let the connected Git branch
   create a Preview deployment. After migrating its database, verify `/up`
   returns `200` and test the existing API authentication and endpoints.
6. Pull Production environment variables locally, run the database migration
   command above, and deploy with `vercel deploy --prod` (or promote the tested
   commit through the connected Git workflow).
7. Verify `https://<deployment-host>/up`, inspect Vercel runtime logs, and test
   login plus a protected API route. Do not use the frontend-root smoke test as
   evidence that the sibling frontend is included.

## Troubleshooting

- **502 / container does not start:** Confirm Caddy binds to Vercel's `PORT`
  (the Caddyfile defaults to 80 only for local use), and inspect deployment
  build/runtime logs.
- **Missing application key:** Add `APP_KEY` to the correct Vercel environment
  and redeploy. Do not regenerate it on each boot.
- **Database connection refused:** Check external database allowlists, TLS,
  credentials, `DB_CONNECTION`, and provider connection limits. Use connection
  pooling where available because many Vercel instances may connect at once.
- **Missing cache table:** Run `php artisan migrate --force` against the
  external database before requests that use database caching.
- **Writes disappear:** This is expected for container-local files. Use the
  external database for state and an object store for durable file uploads.
- **Frontend tests or `/css`, `/js`, `/assets` fail:** Add the frontend source
  to the Docker build context or deploy it separately; it is not present in
  this repository.
