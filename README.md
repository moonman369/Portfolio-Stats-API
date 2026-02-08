# Portfolio Stats API

A serverless-friendly REST API that aggregates GitHub and LeetCode stats for use in a personal portfolio, with MongoDB-backed caching and Swagger docs.

## Table of contents
1. Overview
2. Features
3. Tech stack
4. Architecture
5. API reference
6. Local setup
7. Environment variables
8. Scripts
9. Deployment
10. Security notes
11. Troubleshooting
12. License

## Overview
This service powers a portfolio stats section by exposing endpoints for:
- LeetCode user stats (live via LeetCode GraphQL)
- GitHub stats (refreshed via GitHub GraphQL and stored in MongoDB)
- A refresh endpoint to recompute GitHub aggregates

Interactive docs are available at `/api/docs` when running the server.

## Features
- Express API with versioned routes (`/api/v1/...`)
- Swagger/OpenAPI docs via `swagger-ui-express`
- Serverless handler support (`serverless-http`) with local dev server
- MongoDB persistence for GitHub aggregates
- In-memory caching for LeetCode results (1 hour)
- Vercel cron to auto-refresh GitHub stats daily

## Tech stack
- Node.js + Express
- MongoDB (official driver)
- Swagger (swagger-jsdoc + swagger-ui-express)
- Axios for HTTP/GraphQL
- Vercel serverless deployment

## Architecture
- `api/index.js` boots the Express app, mounts routes, serves Swagger UI, and exports a serverless handler.
- `src/routes/leetcode.js` calls LeetCode GraphQL and caches responses for 1 hour.
- `src/routes/github.js` reads stored GitHub aggregates from MongoDB.
- `src/routes/refresh.js` triggers a GitHub refresh via a worker or direct call (guarded by a secret).
- `refresh_worker.js` fetches all repos via GitHub GraphQL, aggregates totals, and writes to MongoDB.
- `mongo.js` manages MongoDB connection reuse and data access.

## API reference
Base path: `/api/v1`

### GET `/leetcode/:username`
Fetch LeetCode stats for a username (cached for 1 hour).

Response (example):
```json
{
  "status": "success",
  "totalSolved": 219,
  "totalQuestions": 3491,
  "easySolved": 121,
  "totalEasy": 867,
  "mediumSolved": 94,
  "totalMedium": 1813,
  "hardSolved": 4,
  "totalHard": 811,
  "ranking": 512680
}
```

### GET `/github`
Fetch GitHub aggregate stats stored in MongoDB.

Response (example):
```json
{
  "_id": "github_stats",
  "stats": {
    "repos": 106,
    "commits": 1854,
    "pulls": 45,
    "stars": 238
  }
}
```

### GET `/refresh?secret=...&useWorker=true|false`
Recompute GitHub aggregates and store them in MongoDB.

Notes:
- Requires `REFRESH_SECRET` in query string.
- Set `useWorker=true` to run in a worker thread.
- Uses `REFRESH_PROFILE` and `GITHUB_PAT` from environment variables.

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the project root (see Environment variables below).
3. Run locally:
   ```bash
   npm run dev
   ```
4. Open docs:
   - http://localhost:8000/api/docs

## Environment variables
Create a `.env` file in the project root with the following:

```env
# Server
PORT=8000

# MongoDB
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<db>

# GitHub refresh
GITHUB_PAT=ghp_xxx
REFRESH_PROFILE=your-github-username
REFRESH_SECRET=your-refresh-secret
```

## Scripts
- `npm run dev` - Start the local dev server with nodemon
- `npm start` - Start the server
- `npm run build` - Runs the server (Vercel build compatibility)

## Deployment
This repo includes `vercel.json` configured for:
- Serverless entry: `api/index.js`
- Route rewrites to the serverless handler
- Daily cron to refresh GitHub stats:
  - `0 0 * * *` to `/api/v1/refresh?secret=${REFRESH_SECRET}`

If deploying elsewhere, ensure:
- Your platform supports Node.js serverless functions or a long-running server.
- The cron (or equivalent) calls the refresh endpoint with the correct secret.

## Security notes
- Do not expose `GITHUB_PAT` or `REFRESH_SECRET`.
- Restrict the refresh endpoint to internal usage only.
- CORS origins are hardcoded in `api/index.js` � update them for your domains.

## Troubleshooting
- Mongo connection issues: verify `MONGO_URI` and network access to your cluster.
- 401 on refresh: confirm `REFRESH_SECRET` query param matches `.env`.
- Empty GitHub stats: run `/api/v1/refresh` once to populate MongoDB.
- LeetCode errors: verify username and check for upstream availability.

## License
ISC (see `package.json`).
