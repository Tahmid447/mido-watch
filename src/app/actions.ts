"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { session } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import {
  titleSchema,
  watchSchema,
  seasonSchema,
  tasteSchema,
  profileSchema,
  reviewSchema,
  availabilitySchema,
  defaultTaste,
} from "@/lib/model";
import { parseImport } from "@/lib/import";
import { ingestRecommendation } from "@/lib/recommendations";
import { formPriority } from "@/lib/priority";
import { refreshMetadata } from "./bridge-actions";
import { tmdbConfigured } from "@/lib/tmdb";
import seed from "@/lib/v1-seed.json";
export type Result = { error?: string; message?: string };
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const nullable = (f: FormData, k: string) => str(f, k) || null;
const num = (f: FormData, k: string) =>
  str(f, k) === "" ? null : Number(str(f, k));
export async function signIn(_: Result, f: FormData): Promise<Result> {
  try {
    const db = await createClient();
    const { error } = await db.auth.signInWithPassword({
      email: str(f, "email"),
      password: str(f, "password"),
    });
    if (error)
      return { error: "Sign-in failed. Check your email and password." };
  } catch {
    return {
      error:
        "Unable to reach authentication. Check configuration and try again.",
    };
  }
  redirect("/");
}
export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/login");
}
export async function mutate(_: Result, f: FormData): Promise<Result> {
  const { db, user } = await session();
  try {
    const action = str(f, "action");
    const id = str(f, "title_id");
    if (id) z.uuid().parse(id);
    let message = "Saved.";
    const check = (r: { error: { message: string } | null }) => {
      if (r.error) throw new Error(r.error.message);
    };
    if (action === "watch") {
      const value = watchSchema.parse({
        status: str(f, "status"),
        rating: num(f, "rating"),
        notes: str(f, "notes"),
        priority: formPriority(f),
        started_on: nullable(f, "started_on"),
        completed_on: nullable(f, "completed_on"),
        favorite: f.has("favorite"),
      });
      const { in_library: _membership, ...journal } = value;
      const r = await db
        .from("watch_entries")
        .update(journal)
        .eq("user_id", user.id)
        .eq("title_id", id)
        .eq("updated_at", str(f, "expected_updated_at"))
        .select("title_id")
        .single();
      if (r.error)
        throw new Error(
          "This journal changed since you opened it. Reload the page before saving your edits.",
        );
    } else if (action === "quick") {
      const status = watchSchema.shape.status.parse(str(f, "status"));
      check(
        await db
          .from("watch_entries")
          .update({ status, in_library: true })
          .eq("user_id", user.id)
          .eq("title_id", id)
          .select("title_id")
          .single(),
      );
    } else if (action === "favorite") {
      const value = z.enum(["true", "false"]).parse(str(f, "favorite"));
      check(
        await db
          .from("watch_entries")
          .update({ favorite: value === "true" })
          .eq("user_id", user.id)
          .eq("title_id", id)
          .select("title_id")
          .single(),
      );
    } else if (action === "inbox") {
      check(
        await db.rpc("act_on_recommendation", {
          p_title_id: id,
          p_action: z
            .enum(["interested", "watching", "skip", "dismiss"])
            .parse(str(f, "inbox_action")),
        }),
      );
    } else if (action === "season") {
      const value = seasonSchema.parse({
        number: Number(str(f, "number")),
        status: str(f, "status"),
        rating: num(f, "rating"),
        notes: str(f, "notes"),
        rank: num(f, "rank"),
        completed_on: nullable(f, "completed_on"),
      });
      const { data, error } = await db
        .from("titles")
        .select("media_type")
        .eq("id", id)
        .single();
      if (error || data.media_type !== "series")
        throw new Error("A season must belong to your series.");
      if (str(f, "expected_updated_at")) {
        const r = await db
          .from("seasons")
          .update(value)
          .eq("user_id", user.id)
          .eq("title_id", id)
          .eq("number", value.number)
          .eq("updated_at", str(f, "expected_updated_at"))
          .select("number")
          .single();
        if (r.error)
          throw new Error(
            "This season changed. Reload before saving your edits.",
          );
      } else {
        check(
          await db
            .from("seasons")
            .insert({ ...value, title_id: id, user_id: user.id }),
        );
      }
    } else if (action === "add") {
      const title = titleSchema.parse({
        title: str(f, "title"),
        media_type: str(f, "media_type"),
        country: str(f, "country"),
        release_year: num(f, "release_year"),
        synopsis: str(f, "synopsis"),
        tags: str(f, "tags")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        watch: {
          status: str(f, "status"),
          priority: formPriority(f),
        },
      });
      const r = await db.rpc("import_library", {
        payload: { version: 2, titles: [title], taste: [] },
      });
      check(r);
      message = z.object({ skipped: z.number() }).parse(r.data).skipped
        ? "This title already exists. Your existing record was kept."
        : "Title added to your library.";
      if (
        z.object({ skipped: z.number() }).parse(r.data).skipped === 0 &&
        tmdbConfigured()
      ) {
        const lookup = await db
          .from("titles")
          .select("id")
          .eq("title", title.title)
          .eq("media_type", title.media_type)
          .maybeSingle();
        if (lookup.data) {
          const request = new FormData();
          request.set("title_id", lookup.data.id);
          const enrichment = await refreshMetadata({}, request);
          message +=
            " " +
            (enrichment.error
              ? "Artwork can be retried in Settings → Metadata."
              : enrichment.message);
        }
      }
    } else if (action === "metadata") {
      const value = titleSchema
        .pick({
          title: true,
          original_title: true,
          media_type: true,
          country: true,
          release_year: true,
          synopsis: true,
          poster_url: true,
          imdb_id: true,
          tmdb_id: true,
          tags: true,
        })
        .parse({
          title: str(f, "title"),
          original_title: nullable(f, "original_title"),
          media_type: str(f, "media_type"),
          country: str(f, "country"),
          release_year: num(f, "release_year"),
          synopsis: str(f, "synopsis"),
          poster_url: nullable(f, "poster_url"),
          imdb_id: nullable(f, "imdb_id"),
          tmdb_id: num(f, "tmdb_id"),
          tags: str(f, "tags")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      check(
        await db
          .from("titles")
          .update(value)
          .eq("id", id)
          .eq("user_id", user.id)
          .select("id")
          .single(),
      );
    } else if (action === "taste") {
      check(
        await db.from("taste_signals").upsert({
          ...tasteSchema.parse({
            signal: str(f, "signal"),
            weight: Number(str(f, "weight")),
            notes: str(f, "notes"),
          }),
          user_id: user.id,
        }),
      );
    } else if (action === "taste-defaults") {
      check(
        await db.from("taste_signals").upsert(
          defaultTaste.map((s) => ({ ...s, user_id: user.id })),
          { ignoreDuplicates: true, onConflict: "user_id,signal" },
        ),
      );
    } else if (action === "profile") {
      check(
        await db.from("profiles").upsert({
          ...profileSchema.parse({
            display_name: str(f, "display_name"),
            region: str(f, "region").toUpperCase(),
          }),
          user_id: user.id,
        }),
      );
    } else if (action === "recommendation") {
      await ingestRecommendation(db, id, {
        recommended_on: str(f, "recommended_on"),
        priority: formPriority(f),
        reason: str(f, "reason"),
        fit: str(f, "fit"),
        caveat: str(f, "caveat"),
        availability_note: str(f, "availability_note"),
        source: str(f, "source"),
        state: str(f, "state"),
      });
    } else if (action === "review") {
      const value = reviewSchema.parse({
        source: str(f, "source"),
        score: nullable(f, "score"),
        score_type: str(f, "score_type"),
        critic_score: nullable(f, "critic_score"),
        audience_score: nullable(f, "audience_score"),
        vote_count: num(f, "vote_count"),
        captured_on: nullable(f, "captured_on"),
        source_url: nullable(f, "source_url"),
        notes: str(f, "notes"),
        verified: f.has("verified"),
      });
      check(
        await db
          .from("review_snapshots")
          .insert({ ...value, title_id: id, user_id: user.id }),
      );
    } else if (action === "availability") {
      const value = availabilitySchema.parse({
        region: str(f, "region").toUpperCase(),
        provider: str(f, "provider"),
        kind: str(f, "kind"),
        release_on: nullable(f, "release_on"),
        ott_on: nullable(f, "ott_on"),
        theatrical_on: nullable(f, "theatrical_on"),
        verified_on: nullable(f, "verified_on"),
        source_url: nullable(f, "source_url"),
        notes: str(f, "notes"),
      });
      check(
        await db
          .from("availability")
          .insert({ ...value, title_id: id, user_id: user.id }),
      );
    } else if (action === "seed" || action === "import") {
      let payload;
      if (action === "seed") payload = parseImport(seed, true);
      else {
        const file = f.get("file");
        if (!(file instanceof File) || !file.size)
          throw new Error("Choose a JSON backup.");
        if (file.size > 3_000_000)
          throw new Error("Backup exceeds the 3 MB import limit.");
        payload = parseImport(JSON.parse(await file.text()));
      }
      const r = await db.rpc("import_library", { payload });
      check(r);
      const counts = z
        .object({ added: z.number(), skipped: z.number() })
        .parse(r.data);
      message = `Imported ${counts.added} titles. Kept ${counts.skipped} existing titles unchanged.`;
    } else throw new Error("Unknown action");
    revalidatePath("/", "layout");
    return { message };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error instanceof Error
            ? error.message
            : "Unable to save. Try again.",
    };
  }
}
