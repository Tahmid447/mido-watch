# The V2.1 Friday bridge

Open **Settings → Sync**. Download **Export for ChatGPT**, upload that file to ChatGPT, and ask for a human-readable shortlist plus a Recommendation Pack JSON. Paste or upload the pack, preview the identities and evidence, then confirm. New titles arrive in **Picks → New picks**, outside the normal library. “Add to Interested,” “Start Watching,” or “Skip” explicitly accepts a pick; “Dismiss” keeps its recommendation history without adding it to the library.

## Recommendation Pack v1

```json
{
  "schema_version": 1,
  "generated_at": "2026-10-09T09:00:00+09:00",
  "recommendations": [
    {
      "title": "The title",
      "original_title": null,
      "media_type": "movie",
      "release_year": 2026,
      "country": "Japan",
      "imdb_id": null,
      "tmdb_id": null,
      "priority": 82,
      "reason": "A concise, spoiler-free reason to consider it.",
      "fit": "How it connects to recorded preferences.",
      "caveat": "The main potential drawback.",
      "runtime_or_episode_count": "110 minutes, if verified",
      "reviews": [],
      "availability": []
    }
  ]
}
```

Required: schema version, ISO datetime with timezone, 1–100 recommendations, title, media type (`movie` or `series`), integer priority 0–100, and reason. Optional fields receive safe defaults. Maximum upload/paste size is 2 MB. Unknown recommendation fields, including personal watch/rating/notes fields, are rejected. Duplicate identities in one pack are rejected.

Review evidence accepts `source`, `score` as the source’s original string, `score_type`, `critic_score`, `audience_score`, `vote_count`, `captured_on` (YYYY-MM-DD), `source_url` (HTTP/HTTPS), `notes`, and `verified`. A verified review requires both its capture date and source URL. Scores stay separate; no cross-source average is computed.

Availability evidence accepts `region` (uppercase country code, normally JP), `provider`, `kind` (`subscription`, `rent`, `buy`, `theatrical`, `unknown`), `release_on`, `ott_on`, `theatrical_on`, `verified_on`, `source_url`, and `notes`. Dates are YYYY-MM-DD or null; a verification date requires a URL. Do not invent regional release dates. Imported evidence is tagged `chatgpt`, distinct from manual and TMDb records.

A downloadable template is at `/recommendation-pack-example.json`.

## Matching and confirmation

External IDs take precedence. Conflicting IDs, competing editions, or incomplete identity evidence produce a review choice. Fallback uses normalized title, media type, year and territory. The preview never writes. Confirmation revalidates against the current authenticated account and rejects invalid choices or two entries resolving to one title. Ambiguous entries require an explicit existing-title choice or a separate-title choice. Duplicate external IDs or identities still fail safely at the database boundary.

The invoker RPC imports the whole pack in one PostgreSQL transaction under RLS. It updates recommendation context and adds evidence, never personal rating, notes, watch status, taste signals or existing season journals. Existing accepted/dismissed state is retained on later packs. Previous recommendation context is archived in history. A normalized pack hash, also retained in recommendation history, prevents a repeated import from adding duplicate context or evidence and prevents an older pack from replacing a newer one; evidence keys also remain unique across later replays. New title identities are rechecked by the preview before each confirmation.

## ChatGPT Context v1

`GET /api/export/chatgpt` requires a confirmed, non-anonymous authenticated account. The downloaded JSON includes `schema_version`, `exported_at`, `region`, `taste`, and `titles`.

Each title contains its name, media type, year, territory, known external IDs, status and rating, plus meaningful notes, favorites, completion dates, independent season statuses/ratings/ranks/notes and recommendation state/context. It omits database UUIDs, ownership, authentication, credentials, artwork and bulky external metadata. Exported notes are intentionally personal: upload them only to a ChatGPT conversation you choose. The full-fidelity backup remains separately available in Settings.

## Future authenticated sync

V2.1 has no unauthenticated ingestion endpoint and no browser service-role key. Server Actions validate the session on every call; the database uses SECURITY INVOKER and existing owner policies. Future V2.2 sync should reuse the pure pack validator/matcher and transactional RPC behind an explicitly authenticated, revocable integration, with auditable delivery and replay protection. Scheduled delivery, push alerts and automatic public endpoints are not part of V2.1.
