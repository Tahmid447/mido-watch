# Mido Watch V2.1

A private movie and TV journal built with Next.js App Router, TypeScript, Supabase Auth and PostgreSQL. Dark cinema-inspired dashboard, searchable library, independent season journals, personal ratings, evidence-backed recommendations, editable taste signals, regional availability, and portable JSON backups.

The original `Mido Weekend Watchlist.html` is unchanged. `legacy/mido-watch-v1.html` is an identical reference copy. Neither is served by the Next.js app.

## Run locally

Use **Node 24 LTS** (or Node 22.12+). Node 25 is outside the test runner’s supported engine range.

```sh
npm ci
cp .env.example .env.local
# Set your Supabase project URL and publishable key in .env.local.
npm run dev
```

Open http://localhost:3000. This checkout already has an ignored `.env.local` configured for the dedicated Mido Watch project. A clean checkout needs its own environment file. Never put a service-role or secret key in either environment variable.

The provisioned backend is **Mido Watch**, project `asvljelxbdkcuohepwgx`, Tokyo (`ap-northeast-1`), in the Tahmid organization. The three version-controlled migrations have been applied there. Existing unrelated projects were not modified.

## Authentication and first import

1. In the Supabase dashboard, open **Authentication → Users → Add user → Create new user**. Create your own email/password account and confirm it. Do not share the password in chat or commit it.
2. In **Authentication → Sign In / Providers**, disable new-user signups for invite-only operation. There is no public signup UI in this app. Anonymous sign-in should remain disabled. Enable leaked-password protection if available on your plan.
3. Sign in, open **Settings & data**, and choose **Import preserved V1 history**. If you have newer changes in the original browser, export V1 JSON and import that instead before importing the preserved seed. Existing records always win.

Import is explicit per account; signing up never copies the primary user’s private collection to a new account. Browser localStorage cannot be read across sites. Keep a V1 export before retiring the old page.

## Database setup from scratch

For a different hosted project, install dependencies, authenticate the CLI, inspect the target, and apply migrations:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Do **not** reset the hosted database. The Supabase migration ledger tracks which migrations ran; subsequent `db push` runs apply only new files. Migrations are replayable on a fresh database, not intended to be pasted repeatedly into an already migrated schema.

For a fully local Supabase instance, start Docker and run:

```sh
npx supabase start
npx supabase migration up --local
npx supabase status
```

Copy the reported local API URL and publishable/anon key into `.env.local`. Create a local user in Studio. The checked-in local configuration disables signup. Seed import is performed after sign-in, so watch history belongs to the correct user.

## Architecture

- Server-rendered routes fetch limited pages (24 titles by default). Search/filtering/sorting run in PostgreSQL; backups intentionally export the whole owned collection. Per-request session checks are deduplicated with React `cache`.
- `src/lib/data.ts` is the authenticated data-access boundary. `getUser()` checks identity; Supabase SSR refreshes cookies in `src/proxy.ts`. Every mutation authenticates again and validates with Zod. Next.js checks Server Action origins for CSRF.
- Generated database types plus runtime schemas cover SQL and application boundaries. Public environment configuration contains only the publishable key. No privileged backend credential is needed by the application.
- Metadata is a **private per-user catalog** in V2. This prevents another account from learning what is in your library. Title metadata and personal watch state are separate tables; a shared public metadata cache could be added later without changing user-owned journals.
- Composite `(user_id, title_id)` foreign keys prevent attaching one account’s notes, seasons, reviews or recommendations to another’s title. RLS covers all eight tables. All RPCs use `SECURITY INVOKER`.
- Watch journal and season edits use optimistic concurrency checks. A stale form is rejected instead of silently replacing a newer edit. Quick actions update only status. Dates are explicit; clicking “watched” does not invent a completion date.
- Season status/rating/notes/rank/completion date are independent. Overall series status is manually editable; importing a partly watched series initializes it to “watching.”
- Recommendation lifecycle (`new`, `accepted`, `dismissed`) is separate from watch status. “Watching,” “watched,” and “skipped” come from the journal rather than a second conflicting state.
- Tracking works without an external API. Configure a server-only TMDb credential for artwork, trailers and provider enrichment.

### Tables

| Table              | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| `titles`           | Owned metadata, optional external identifiers, tags         |
| `watch_entries`    | Personal status, rating, priority, notes, dates, favorite   |
| `seasons`          | Independent numbered season journals and personal rank      |
| `review_snapshots` | Source-specific scores, capture date and evidence           |
| `availability`     | Region/provider/type, release/OTT/cinema dates and evidence |
| `recommendations`  | Reason, fit, caveat, priority, source and acceptance        |
| `taste_signals`    | Signed weights from −5 to +5 with notes                     |
| `profiles`         | Private display name and preferred region                   |

External scores are never averaged. A verified review needs a capture date and source URL. Availability permits any provider, rental, purchase or theatrical records. `JP` is Japan; imported `ZZ` means the V1 record did not identify a region. Unknown dates remain null. Upcoming releases show only sourced, verified records in your preferred region, sorted by their next future release event.

## Migration and backups

`npm run seed:extract` extracts the trusted, preserved V1 seed into `src/lib/v1-seed.json`. User imports are parsed as JSON, never evaluated as code.

The 47 V1 entries become **44 titles and 6 season records**. Reacher seasons 1–3 are watched, season 4 is not watched; personal ranks are S2 #1, S1 #2, S3 #3. Paatal Lok seasons 1 and 2 are watched. Maharaja, Alice in Borderland, Squid Game, 1122 and the rest of the V1 history are retained. V1 external scores and platform claims are preserved as **unverified**, including their original context; personal ratings are not fabricated. No exact completion date is inferred from a month-only note.

Imports accept V1 `{version:1,titles:[...]}`, a raw V1 localStorage array, or V2 backups. The entire import is one PostgreSQL transaction. Duplicates are skipped by normalized title/type/year/country or a matching external identifier. Related data on an existing title is also skipped, so an older backup cannot erase newer edits. Review the returned imported/skipped counts. Ambiguous duplicates inside a V1 file are rejected for correction. Same-named remakes can be distinguished by release year/country.

Exports include journals, seasons, evidence, recommendations, taste and profile. IDs are not used to transfer ownership. A backup restores into the signed-in account. Imports are additive, not destructive restore/merge tools. Limit: 3 MB / 10,000 titles per import; split larger collections before import. Dates and foreign IDs remain optional.

## Tests

```sh
npm test                  # real PostgreSQL via PGlite + import tests; no Docker needed
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The default browser suite always checks logged-out boundaries. Full authenticated flows need two **disposable** users in a dedicated test project:

1. Configure `.env.local` for that test project and apply migrations.
2. Run `node scripts/prepare-test-users.mjs`. It generates ignored `.env.test-users.json` credentials and `.env.test-users.sql` containing hashes, not plaintext passwords.
3. Apply that SQL only to the intended test project using an authenticated administrator/SQL editor. This creates test fixtures without sending email; it is not the production account creation path.
4. Run `npm run test:e2e` and `node scripts/verify-hosted.mjs`.
5. Delete only those exact generated test user IDs from `auth.users` after testing, then delete the ignored fixture files. Cascades remove their test data. Do not reuse production user credentials.

Browser tests cover desktop and iPhone viewport workflows. PGlite runs actual PostgreSQL policy/constraint/transaction behavior using a minimal `auth.uid()` test shim. Hosted REST checks additionally validate real Supabase Auth and permissions. See [verification report](docs/verification.md) for the performed checks and limits.

## Deploy

Deploy this branch to Vercel or another Node-compatible Next.js host:

1. Import the repository and choose the V2 branch. Use Node 24, `npm ci`, and `npm run build`; on a Node host start with `npm start`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the deployment environment before building. The public key is safe with the applied RLS; never use a secret/service-role key here.
3. Apply version-controlled migrations to the selected backend before releasing. The dedicated Tokyo backend already has these migrations.
4. Set Supabase Auth’s Site URL to the HTTPS app origin and keep allowed redirects restricted to your deployed origin and needed localhost addresses. Disable new-user signup for private operation.
5. Verify logged-out redirect, sign-in, a journal edit, and JSON export on the deployed origin. Do not CDN-cache authenticated HTML or `/api/export`.

V1 is not a Next.js public asset and remains available through Git as rollback/reference. This work does not deploy a public frontend or change the default branch automatically.

## Deferred to V2.2

Direct authenticated/scheduled ChatGPT delivery, automated taste scoring, episode-level journals, other licensed critic/review feeds, passkeys/OAuth, self-service password recovery, destructive restore and field-level backup conflict resolution. V2.1 implements TMDb enrichment and the previewed manual recommendation bridge.

## V2.1 — cinematic discovery and the Friday bridge

The existing private catalog now has portrait posters, cinematic backdrops, official YouTube trailer dialogs, source-specific review chips and Japan provider metadata. Personal ratings stay in the watch journal. Priority remains numeric in storage but uses Must Watch / Strong Pick / Worth Watching / Maybe / Low Priority in ordinary screens; numeric overrides live under Advanced priority.

### TMDb configuration

In the ignored `.env.local` (or the host’s server environment), set **one** of:

```dotenv
TMDB_READ_ACCESS_TOKEN=your-long-api-read-access-token
# Alternatively, the TMDb v3 API Key:
TMDB_API_KEY=your-api-key
```

Obtain either credential from [TMDb Settings → API](https://www.themoviedb.org/settings/api). The read token uses an Authorization header; the alternative key is sent only from the server to TMDb. Never prefix either with NEXT_PUBLIC, commit it, or paste it into a recommendation pack. Requests do not log credential-bearing URLs. Restart the local server after editing the environment; host deployments need the variable in their server environment. Newly added titles attempt enrichment when configured; imported Friday picks can be enriched in the Metadata studio.

Open **Settings → Metadata** to refresh missing titles in batches of six, refresh a selected title, search an alternative name, enter a known TMDb ID, or choose a reviewed candidate. Known IDs are used directly. Search auto-matches only one exact normalized title with independent year or known-territory evidence; competing editions stay in review. Bilingual parenthetical aliases are considered. Network failures record an actionable state and can be retried.

Metadata stores responsive poster/backdrop paths, release date, genres, runtime, language, episode/season information, official trailer identifiers, candidates, errors and refresh time. The transactional refresh only changes external metadata and TMDb-owned evidence. It adds missing season placeholders without changing existing status, notes, ratings or ranks. Manual and ChatGPT evidence survive automated refresh. TMDb provider data is labeled as automated, visibly attributed to JustWatch wherever displayed, and never creates an OTT date. Confirm availability with the linked provider listing.

Only an official YouTube Trailer with a valid video ID creates a Watch Trailer button. The iframe is mounted inside the dialog after opening, uses youtube-nocookie, has autoplay disabled, closes with Escape, stops by unmounting and returns focus to its trigger. Broken or missing artwork gets a readable fallback, including failures before hydration.

### Weekly recommendations

Use **Settings → Sync** to export compact ChatGPT context and preview/import a Recommendation Pack. New picks stay outside the library until accepted; dismissal preserves recommendation history. No personal fields are overwritten during import. See [the complete bridge schema and security contract](docs/recommendation-sync.md).

The additive V2.1 migration keeps all eight existing owner-protected tables and adds JSON metadata, library membership, evidence provenance/uniqueness and recommendation history. Backups remain version 2 and retain the new fields; old V1/V2 imports remain compatible and non-destructive.

### Validation and review

Use Node 24 LTS. Run `npm test`, `npm run typecheck`, `npm run build`, then `npm run test:e2e`. Authenticated browser workflows require the disposable account fixtures described above. Cinematic smoke tests isolate image/player requests while exercising hosted Auth/RLS, dialog lifecycle, responsive image sizes, fallback art, provider attribution and desktop/mobile overflow. Live account screenshots and enrichment results are recorded in the V2.1 completion report; test fixture media is not production evidence.

PR #1 stays draft. No production frontend deployment or merge is authorized by this upgrade.
