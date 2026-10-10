import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, configured } from "./supabase/server";
import { titleSchema, profileSchema, tasteSchema, type Title } from "./model";
export const session = cache(async function session() {
  if (!configured()) redirect("/login");
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) redirect("/login");
  return { db, user: data.user };
});
export const documentSchema = titleSchema.extend({
  id: z.uuid(),
  updated_at: z.string(),
});
export type Filters = Record<string, string>;
export function filtersFrom(
  params: Record<string, string | string[] | undefined>,
): Filters {
  const out: Filters = {};
  for (const key of [
    "q",
    "status",
    "type",
    "country",
    "tag",
    "platform",
    "sort",
    "recommended",
    "rec_state",
  ])
    if (typeof params[key] === "string") out[key] = params[key].slice(0, 200);
  for (const key of ["rating", "priority", "year", "offset", "limit"])
    if (
      typeof params[key] === "string" &&
      (key === "rating" ? /^\d+(\.\d+)?$/ : /^\d+$/).test(params[key])
    )
      out[key] = params[key];
  return out;
}
export async function library(filters: Filters = {}) {
  const { db } = await session();
  const { data, error } = await db.rpc("library_page", { filters });
  if (error) throw new Error(error.message);
  return z
    .object({ total: z.number(), titles: z.array(documentSchema) })
    .parse(data);
}
export async function titleById(id: string): Promise<Title | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { db } = await session();
  const { data, error } = await db
    .from("titles")
    .select(
      "*,watch_entries(*),seasons(*),review_snapshots(*),availability(*),recommendations(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return documentSchema.parse({
    ...data,
    watch: data.watch_entries,
    seasons: data.seasons,
    reviews: data.review_snapshots,
    recommendation: data.recommendations ?? null,
  });
}
export const profile = cache(async function profile() {
  const { db, user } = await session();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return profileSchema.parse(data ?? {});
});
export async function taste() {
  const { db } = await session();
  const { data, error } = await db
    .from("taste_signals")
    .select("*")
    .order("weight", { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(tasteSchema).parse(data);
}
export async function upcoming() {
  const [{ db }, p] = await Promise.all([session(), profile()]);
  const { data, error } = await db.rpc("upcoming_releases", {
    p_region: p.region,
  });
  if (error) throw new Error(error.message);
  return data;
}
