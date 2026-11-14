# Mido Watch V2.2 production release

Published 14 November 2026, Japan, following explicit owner authorization.

- **URL:** https://mido-watch-blackchocot2-5016.vercel.app
- **Target / status:** Production / READY, promoted after validation.
- **Deployment:** `dpl_8hKzTpDVpL3TmBhbWqBeBFrn6Wj3`.
- **Deployed source:** `26ee3109f9532d07ac59b73e87efbc9289b358b3` on `codex/mido-watch-v2`.
- **Framework / project setting:** Next.js 16.4.6 / Node.js 24.x.
- **Build:** completed successfully in 28 seconds, then promoted without rebuilding.
- **Project:** existing `prj_lgL3aHoAseG3TM5wAh04i8fpxMD0`, renamed from `mido-watch-preview` to `mido-watch` in the same Hobby team.

## Access and configuration

The stable production URL requires only the application's existing Supabase account. It does not require Vercel login. Preview and immutable production deployment URLs retain Vercel Authentication. No app authentication or RLS policy was removed or weakened.

The existing public Supabase URL/publishable key and one sensitive server-only TMDb credential are configured separately for Production and Preview. Values are never committed. Supabase Auth uses the production origin as Site URL, with exact production redirects added while retaining localhost and existing Preview entries. The original Supabase project and database were retained, with no release-time schema migration or reset.

This is a manual release from the reviewed branch. PR #1 remains draft and unmerged. No automatic Git production deployment was connected.

## Validation

- Prior application checks: 45 unit/PostgreSQL tests, TypeScript, optimized build, clean dependency audit and green CI.
- Eight desktop Chromium / iPhone-sized Chromium browser scenarios pass against the production build. The two long journal workflows were rerun with an assertion wait that covers the existing bounded TMDb metadata lookup. New title fixtures are unique on every run, so a rerun still exercises creation.
- Desktop/mobile checks on the exact promoted production URL verify app sign-in, Audit, Plan, Sync, private compact context export, responsive layout and sign-out without a deployment-protection bypass.
- Anonymous private pages redirect to `/login`; anonymous backup and compact-context requests return 401. Hosted Auth/REST/RLS checks cover all nine tables and cross-owner RPC denial.
- Disposable test accounts/sessions/data and temporary validation access are removed after checks. Private owner exports before/after release confirm journal, taste and plan preservation; actual history and counts remain private.
- Physical Safari was not tested.

## Post-release observability

Vercel runtime error/fatal logs are checked for this deployment during the release window. No external log drains are configured; this release does not create a new monitoring service or scheduled task. The final error scan and cleanup receipt are retained in ignored local release evidence.
