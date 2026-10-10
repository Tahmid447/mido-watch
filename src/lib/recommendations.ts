import "server-only";
import type { Database } from "./supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recommendationSchema } from "./model";
// The caller supplies a user-authenticated client. Never accepts user_id from input.
export async function ingestRecommendation(
  db: SupabaseClient<Database>,
  titleId: string,
  input: unknown,
) {
  const value = recommendationSchema
    .pick({
      recommended_on: true,
      priority: true,
      reason: true,
      fit: true,
      caveat: true,
      availability_note: true,
      source: true,
      state: true,
    })
    .parse(input);
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user || user.is_anonymous)
    throw new Error("Authentication required");
  const { error } = await db
    .from("recommendations")
    .upsert({ ...value, title_id: titleId, user_id: user.id });
  if (error) throw new Error(error.message);
}
