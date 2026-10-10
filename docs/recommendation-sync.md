# Future authenticated recommendation ingestion

`src/lib/recommendations.ts` exports `ingestRecommendation(db, titleId, input)`. It validates the payload, verifies the caller with Supabase Auth, derives `user_id` from that identity and upserts one recommendation per owned title. The supplied client must carry a user access token. RLS and composite foreign keys enforce ownership even if the caller supplies a foreign title ID.

No webhook or public ingestion endpoint exists in V2. The weekly ChatGPT task remains separate and has not been modified.

For a future integration, add a server-side worker or HTTPS route with narrowly scoped authentication. Authorize the target account from a trusted integration registration; never trust a submitted `user_id`. Validate payloads using `recommendationSchema`, rate-limit calls, log the authenticated integration and source, and use a per-job idempotency key. Use a user-scoped Supabase client wherever possible. Keep credentials in the worker’s secret store. If service-role privileges eventually become unavoidable, explicitly authorize each operation before using them; that key must never enter client bundles, JSON backups, URLs, or logs.

Resolve a title by IMDb ID, TMDb ID plus media type, or the normalized title/type/year/country key. If identity is ambiguous, return a review-needed result instead of creating a probable duplicate. A metadata adapter can return a `titleSchema` payload; importing it through the existing invoker RPC is atomic and non-destructive. Recommendation ingestion must not overwrite personal notes, ratings, status, or season rankings.

Reasons and fit notes must be short and spoiler-free. Keep caveats and availability uncertainty explicit. External score scales remain separate; require a source URL and capture date before declaring review evidence verified. Do not promote unverified legacy claims to verified facts.
