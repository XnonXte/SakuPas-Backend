# SakuPas Backend

Express.js API for SakuPas, deployed as a Vercel Node.js function and connected to
PostgreSQL/Neon. The API preserves the existing `/api/v1` routes and supports
the current hashed bearer tokens.

- [API endpoints](./API.md)
- [Local setup and Vercel deployment](./DEPLOYMENT.md)
- Database schema migration: `database/node-migrations/001_initial_schema.sql`

Run locally with Node.js 20+:

```powershell
npm ci
Copy-Item .env.example .env.node
$env:DOTENV_CONFIG_PATH = '.env.node'
# Configure a dedicated development PostgreSQL database in .env.node.
npm test
npm start
```

The API listens on `PORT` (default `3000`); the health endpoint is `/up`.
Database migrations are operator-run and are never executed on application startup.
