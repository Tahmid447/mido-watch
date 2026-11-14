"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { session } from "@/lib/data";
import type { Result } from "./actions";
const date = z.iso.datetime({ offset: true }).nullable();
const optional = (f: FormData, k: string) => String(f.get(k) ?? "") || null;
export async function confirmWatch(_: Result, f: FormData): Promise<Result> {
  const { db } = await session();
  try {
    const value = z
      .object({
        p_title_id: z.uuid(),
        p_status: z.enum([
          "watched",
          "watching",
          "not-watched",
          "interested",
          "skip",
          "unsure",
        ]),
        p_season: z.coerce.number().int().min(0).max(1000).nullable(),
        p_expected: date,
      })
      .parse({
        p_title_id: f.get("title_id"),
        p_status: f.get("status"),
        p_season: optional(f, "season"),
        p_expected: optional(f, "expected"),
      });
    const { error } = await db.rpc("audit_status", {
      ...value,
      p_season: value.p_season ?? undefined,
      p_expected: value.p_expected ?? undefined,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return {
      message:
        value.p_status === "unsure"
          ? "Flagged for confirmation. Your saved verdict and rating were kept."
          : "Watch status confirmed.",
    };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? "Choose a valid watch status."
          : e instanceof Error
            ? e.message
            : "Unable to save.",
    };
  }
}
export async function changePlan(_: Result, f: FormData): Promise<Result> {
  const { db } = await session();
  try {
    const value = z
      .object({
        p_action: z.enum([
          "add",
          "up",
          "down",
          "start",
          "complete",
          "postpone",
          "remove",
          "replace",
          "schedule",
        ]),
        p_item_id: z.uuid().nullable(),
        p_title_id: z.uuid().nullable(),
        p_season_number: z.coerce.number().int().min(0).max(1000).nullable(),
        p_week: z.coerce.number().int().min(1).max(4).nullable(),
        p_expected: date,
        p_journal_expected: date,
        p_label: z.string().max(300),
      })
      .parse({
        p_action: f.get("plan_action"),
        p_item_id: optional(f, "item_id"),
        p_title_id: optional(f, "replacement") || optional(f, "title_id"),
        p_season_number: optional(f, "season"),
        p_week: optional(f, "week"),
        p_expected: optional(f, "expected"),
        p_journal_expected: optional(f, "journal_expected"),
        p_label: String(f.get("label") ?? ""),
      });
    const { error } = await db.rpc("edit_plan", {
      ...value,
      p_item_id: value.p_item_id ?? undefined,
      p_title_id: value.p_title_id ?? undefined,
      p_season_number: value.p_season_number ?? undefined,
      p_week: value.p_week ?? undefined,
      p_expected: value.p_expected ?? undefined,
      p_journal_expected: value.p_journal_expected ?? undefined,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return {
      message:
        value.p_action === "remove"
          ? "Removed from this plan. Your watch history is kept."
          : "Plan updated.",
    };
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? "Choose a title and valid week from your collection."
          : e instanceof Error
            ? e.message
            : "Unable to update your plan.",
    };
  }
}
