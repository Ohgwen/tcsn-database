# TCSN Roster

Internal roster and notes app for the Tennessee Club Sports Network. It's a static HTML/CSS/vanilla-JS frontend with Cloudflare Pages Functions for the API and Cloudflare D1 (SQLite) for storage. There's no build step and no server to manage.

```
public/            static frontend (served as-is)
  index.html       roster list (search + filters)
  person.html      profile + notes timeline + quick-add
  edit.html        add / edit person
  import.html      CSV import (preview, then commit)
  login.html       password gate
functions/         Pages Functions (the API)
  _middleware.js   password/session check on every route (pages and API)
  api/login.js     POST = log in, DELETE = log out
  api/people/…     GET/POST /api/people, GET/PUT/DELETE /api/people/:id, POST /api/people/:id/notes
  api/notes/[id].js  PUT/DELETE a single note (typo fixes)
  api/import.js    POST CSV upsert
lib/               shared code (field list, CSV parser, auth)
migrations/        D1 schema
scripts/csv-to-sql.mjs  roster CSV -> SQL seed file
```

## One-time setup

Requires Node 18+ and a Cloudflare account (the free tier is enough).

```sh
npm install                          # installs wrangler locally
npx wrangler login                   # opens browser to authorize wrangler

# 1. Create the D1 database
npx wrangler d1 create tcsn-db
#    -> copy the printed database_id into wrangler.toml (replace the 0000… placeholder)

# 2. Create the tables in the remote (production) database
npx wrangler d1 migrations apply tcsn-db --remote

# 3. Create the Pages project
npx wrangler pages project create tcsn-roster --production-branch main

# 4. Set the shared club password (you'll be prompted to type it)
npx wrangler pages secret put APP_PASSWORD --project-name tcsn-roster

# 5. Deploy
npx wrangler pages deploy
```

The site will be at `https://tcsn-roster.pages.dev`. Redeploy after any code change with `npx wrangler pages deploy`.

The D1 binding (`DB`) is declared in `wrangler.toml`, so it's applied on every deploy and doesn't need to be set in the dashboard.

## Loading the initial roster

Your CSV needs a header row. Headers are matched to the column names in the schema. Case, spaces, and punctuation don't matter, so `Net ID`, `net_id`, and `NetID` all work. The only required column is `name`, and unknown columns are ignored. See `sample-roster.csv` for the format.

Boolean columns (`interest_form_submitted`, `production_form_submitted`, `interviewed`) treat `Yes/Y/True/1/X/Submitted/Done` as true and everything else as false. `has_car` and `can_transport_equipment` are normalized to `Yes`/`No` when the value is yes/no-like.

**Option A: SQL seed (good for the very first load):**

```sh
node scripts/csv-to-sql.mjs roster.csv > roster.seed.sql
npx wrangler d1 execute tcsn-db --remote --file roster.seed.sql
```

This does plain INSERTs, so run it only once against an empty table.

**Option B: in-app import (good for first load *and* future refreshes).** Log in and go to **Import** (top right of the roster). Pick the CSV, click **Preview** to see how many people will be added or updated and any problem rows, then click **Import**.
- Each row matches an existing person by NetID, then email, then exact name (case-insensitive). Matches are updated and everyone else is inserted.
- Blank cells never erase existing data.
- Notes are never touched.

## Local development

```sh
cp .dev.vars.example .dev.vars                     # sets APP_PASSWORD for local use
npx wrangler d1 migrations apply tcsn-db --local   # creates a local SQLite copy in .wrangler/
node scripts/csv-to-sql.mjs sample-roster.csv > sample.seed.sql
npx wrangler d1 execute tcsn-db --local --file sample.seed.sql
npx wrangler pages dev                             # http://localhost:8788
```

## Useful D1 commands

```sh
# Ad-hoc query against production
npx wrangler d1 execute tcsn-db --remote --command "SELECT name, status_active FROM people ORDER BY name"

# Full backup (schema + data) to a local file (do this before big imports)
npx wrangler d1 export tcsn-db --remote --output backup-$(date +%F).sql

# D1 also keeps 30 days of point-in-time history:
npx wrangler d1 time-travel info tcsn-db
```

## Schema changes

Add a new file such as `migrations/0002_add_shirt_size.sql` (for example `ALTER TABLE people ADD COLUMN shirt_size TEXT;`), then run `npx wrangler d1 migrations apply tcsn-db --remote`. To make a new column editable in the UI, add it to `PERSON_FIELDS` in `lib/people.js` and to `FIELD_GROUPS` in `public/js/common.js`.

Note categories are validated in `lib/people.js` (`NOTE_CATEGORIES`), and their colors live in `public/js/common.js` (`CATEGORIES`) and `public/app.css`.

## Access and security notes

- Every page, script, and API route (except the login page and stylesheet) requires a valid session cookie. The cookie is HMAC-signed with `APP_PASSWORD`, is `HttpOnly`/`Secure`, and lasts 30 days.
- **Changing the password logs everyone out.** That's the way to revoke access if the password leaks:
  `npx wrangler pages secret put APP_PASSWORD --project-name tcsn-roster`, then `npx wrangler pages deploy`.
- Mutating API calls must be `application/json`, which blocks cross-site form CSRF.
- Pages send `noindex` headers so search engines won't list the site.
- Pick a long password. There's no lockout, just a small delay on wrong attempts. If you later want per-person logins (for example, only @utk.edu Google accounts), put the site behind **Cloudflare Access** (Zero Trust, free for up to 50 users) with no code changes.
- **Preview deployments** (`<hash>.tcsn-roster.pages.dev`) use the Preview environment. If you use them, also add `APP_PASSWORD` under Dashboard → Workers & Pages → tcsn-roster → Settings → Variables and Secrets → **Preview**. Without it, preview URLs just show a "not configured" error (they stay locked). Preview deployments also share the same D1 database unless you configure a separate one.
