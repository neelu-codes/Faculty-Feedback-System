# Backend and database decision

## Recommendation: Node.js + Express + SQLite (what this project uses)

| | Node + Express + SQLite | Firebase (Auth + Firestore) | Supabase (Postgres) |
|---|---|---|---|
| Needs internet/account for demo | **No** (runs offline in a lab) | Yes | Yes |
| Real backend code to explain in viva | **Yes** (routes, middleware, validation) | Mostly client-side SDK calls | Mostly client-side + SQL policies |
| Data model | **Relational (SQL), ER diagram, joins** | NoSQL documents | Relational (SQL) |
| Security | Enforced in server code | Needs correct Security Rules (your old rules were `allow ... if true`, i.e. open to everyone) | Needs Row Level Security |
| Cost/limits | Free | Free tier read/write quotas (your old docs track "reads" for this reason) | Free tier limits |
| Hosting | Any Node host | Static + Firebase | Static + Supabase |
| Weak point | Needs a Node host for a public link; free hosts may wipe the SQLite file | Vendor lock-in; harder to show a "backend" | Less control than own server |

**Why it fits your rubric:** B1/B2/B5/B6 reward understanding of *your own* work. A visible backend and an SQL schema give you far more to explain and defend than SDK calls. It also works without internet in a college lab and has no dependency on a Google account that could be lost.

**When to choose Firebase instead:** your college requires a hosted public URL with zero server, or demos are always online. Because every page talks only to `public/js/api.js`, switching means rewriting that one file (about 90 lines) plus moving the validation that now lives in `server/server.js`. Do **not** reuse the old open rules.

**If your college mandates PHP/MySQL:** `schema.sql` is almost plain SQL; change `AUTOINCREMENT` to `AUTO_INCREMENT` and `datetime('now')` to `NOW()`, and re-implement the routes in `server/server.js` as PHP endpoints with the same JSON shapes. The frontend stays unchanged.

## Upgrade path
SQLite -> MySQL/Postgres: replace `server/db.js` with `mysql2`/`pg`, and convert the `db.prepare(...).run/get/all` calls to async queries. The schema carries over.
