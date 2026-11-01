# rig

Keeps a lane's lights on while nobody is in it: a heartbeat every minute, a status board, and
a morning digest of what ran overnight.

```sh
cp .env.example .env   # set LANE_MARKER
pnpm install
pnpm dev               # http://localhost:8787
```

`GET /digest/:night` (for example, `/digest/2026-10-28`) shows one row per job, sorted by job,
with run counts, retries, last status/error, owner, and the original timestamp offsets.
Rows with at least three retries or a failed last status are marked. Missing owners and errors
display as `—`; malformed lines are counted and skipped. A missing night returns 404, and an
empty night says “nothing ran”. Like the status board, the digest uses server-rendered HTML
with no client JavaScript.

Working on it with an agent: start at [AGENTS.md](AGENTS.md).

The status board lists nights newest first, with links to `/digest/<night>` and counts of
jobs whose last status is `ok`, `retry`, or `fail`. Counts describe one outcome per job,
not total run attempts or retries; an empty night shows zeroes and unavailable data shows `—`.
