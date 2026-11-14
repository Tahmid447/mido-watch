# V2 foundation verification — 10 October 2026 (Japan)

## Implemented and exercised

- Next.js 16.4.0, React 19.3.0, Supabase JS 2.117.3 and SSR 0.12.7. Versions were checked against the package registry and current Next.js/Supabase documentation, then locked. Final builds and unit/database tests ran under Node 24 LTS.
- Eight private tables with ownership policies, composite owner foreign keys, checks and indexes. Three migrations applied to the dedicated Tokyo Supabase project; local migration versions match the remote ledger.
- 16 unit/database tests execute import preservation, deduplication, rollback, RLS, foreign ownership rejection, watch/season persistence, querying, backup round-trip, deterministic pagination, and sourced regional release dates against real PostgreSQL via PGlite.
- Four Playwright tests exercise anonymous boundaries and authenticated workflows at desktop and iPhone 13 viewports. Full flows use temporary hosted Auth users, not mocks. They cover login, V1 import, search, journal/season edits, recommendations, taste, review/availability entry, manual title entry, export/import and sign-out. Dashboard screenshots were visually inspected; no horizontal overflow was detected.
- Hosted REST verification checks anonymous and cross-user access across all eight tables, including delete attempts, forged ownership, ownership reassignment, foreign season insertion and anonymous RPC calls. Supabase password authentication was exercised against the provisioned project.
- TypeScript checking and the optimized production build pass. Dependency audit reports zero known production vulnerabilities at the time of the check.
- Original V1 HTML and its legacy copy compare byte-for-byte. Extraction retains 47 original seed records, consolidating them into 44 titles and 6 seasons. Rerunning import keeps existing user changes.
- Staged files were checked for private keys, JWT credentials, Supabase secret keys, GitHub tokens and accidentally tracked environment files. None were found. Only `.env.example` is tracked. No service-role credential is used by the app.

## Security boundaries

No anonymous role privileges on private tables/RPCs. Every user-owned table has RLS enabled; authenticated policies require `auth.uid() = user_id` in both `USING` and `WITH CHECK`. All application SQL functions run as invoker. The app checks authenticated identity on reads, exports and mutations. Public signup UI and public ingestion endpoints are absent. Next.js provides origin checking on Server Actions. Watch and season forms reject stale writes.

Supabase’s security advisor reports no table/RLS/function warnings. It reports one Auth warning: **leaked-password protection is disabled**. [Supabase remediation guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Enable it if available for the project’s plan. Production invite-only signup settings remain a dashboard configuration step; RLS protects existing users even if other accounts can register.

## Limits and remaining setup

The full hosted workflow was tested using disposable accounts, which were removed after validation. The owner subsequently created a confirmed personal Supabase Auth account. The preserved V1 seed was imported through the existing invoker RPC under that account’s authenticated database role: 44 titles added, 0 skipped, 6 seasons and 18 taste signals. Stored ownership, Reacher season statuses/ranks, both watched Paatal Lok seasons, the JP profile region and unverified legacy review flags were checked after import. New browser-only V1 edits remain unavailable until the owner exports that browser’s localStorage data.

No live frontend deployment or custom domain was created. The production build is verified locally; host-specific deployment configuration and a smoke test on the final HTTPS origin remain necessary. The README contains deployment steps. CI performs unit/database/build and logged-out browser checks; authenticated browser checks require dedicated test users and are skipped if those fixtures are absent.

Chromium mobile emulation is not physical iPhone/Safari testing. No external critic scores, streaming availability or release dates were researched or newly verified; V1 claims remain explicitly unverified. Automated metadata, release feeds and ChatGPT sync remain V2.1 work.

For the subsequent cinematic upgrade, live enrichment and extended validation, see [V2.1 completion and review notes](v2.1-completion.md).
