# Watchlist Worker

A standalone Node service (deployed on Railway) that keeps a competitor-ad
watchlist fresh on an interval. It's the piece Vercel's serverless model doesn't
do well: a durable loop that fans out multi-minute Apify scrapes with no request
holding it open and no function time ceiling.

## Where it fits

```
Vercel (app)  ──serves──▶  users
Apify         ──runs────▶  the ad-library scrapes
Railway       ──schedules & ingests──▶  THIS WORKER
Supabase      ──stores──▶  research_runs  ◀──reads── app "Recent" chips
```

Each cycle works through the watchlist. For every query it starts an Apify run,
polls it to completion, analyzes the ads with Claude (hook, angle, reproduction
prompt), and upserts the result into Supabase with `source = 'watchlist'`. The
app's Ad Intelligence page reads those rows back, so worker-produced researches
show up under "Recent" with an amber dot, clickable like any other.

## Env

| Var | Required | Default |
|-----|----------|---------|
| `APIFY_TOKEN` | yes | (none) |
| `ANTHROPIC_API_KEY` | yes | (none) |
| `SUPABASE_URL` | yes | (none) |
| `SUPABASE_ANON_KEY` | yes | (none) |
| `WATCHLIST` | no | 4 sample niches (JSON array of `{query,kind,country}`) |
| `REFRESH_INTERVAL_MINUTES` | no | `360` (6h) |
| `ADS_PER_QUERY` | no | `5` |
| `ANALYST_MODEL` | no | `claude-sonnet-5` |

## Run

```bash
npm install
npm start
```

Deployed on Railway with the repo root set to `worker/`. Railway runs
`npm install` then `npm start` and keeps the process alive.
