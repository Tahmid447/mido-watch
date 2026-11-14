import { titleSchema } from "../../src/lib/model";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
const users: { id: string; email: string; password: string }[] = existsSync(
  ".env.test-users.json",
)
  ? JSON.parse(readFileSync(".env.test-users.json", "utf8"))
  : [];
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
test("audit, independent seasons, plan order and friendly sync", async ({
  page,
}, info) => {
  test.skip(
    !users.length,
    "Needs disposable test accounts or npm run test:e2e:isolated.",
  );
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  expect((await db.auth.signInWithPassword(users[0])).error).toBeNull();
  const movie = `Audit movie ${info.project.name}`,
    series = `Audit series ${info.project.name}`,
    pick = `Plan replacement ${info.project.name}`;
  const inserted = await db.rpc("import_library", {
    payload: {
      version: 2,
      titles: [
        {
          title: movie,
          media_type: "movie",
          synopsis: "Grounded police investigation",
          metadata: { runtime_minutes: 105 },
          watch: {
            status: "watching",
            rating: 8,
            notes: "Temporary fixture reaction",
            priority: 82,
            confirmation_needed: true,
          },
        },
        {
          title: series,
          media_type: "series",
          watch: { status: "interested", priority: 82 },
          seasons: [
            {
              number: 1,
              status: "not-watched",
              rating: 8,
              notes: "Keep this season reaction",
            },
          ],
        },
        {
          title: pick,
          media_type: "movie",
          synopsis: "Police investigation with evidence gathering",
          metadata: { runtime_minutes: 100 },
          watch: { status: "interested", priority: 95 },
          recommendation: {
            recommended_on: "2026-11-14",
            reason: "A grounded investigation",
            fit: "Procedural detail",
            caveat: "A patient opening",
            priority: 95,
            state: "new",
          },
        },
      ].map((t) => titleSchema.parse(t)),
      taste: [],
    },
  });
  expect(inserted.error).toBeNull();
  const lookup = await db.from("titles").select("id,title");
  expect(lookup.error).toBeNull();
  const id = (name: string) => lookup.data!.find((t) => t.title === name)!.id;
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/audit");
  const movieCard = page
    .locator(".audit-card")
    .filter({ has: page.getByRole("heading", { name: movie, exact: true }) });
  await expect(movieCard).toBeVisible();
  await movieCard.getByRole("button", { name: "Watched", exact: true }).click();
  await expect(movieCard).toHaveCount(0);
  await page
    .getByRole("group", { name: "Watch Audit filters" })
    .getByRole("button", { name: "Watched", exact: true })
    .click();
  await expect(movieCard).toBeVisible();
  await movieCard.getByRole("button", { name: "Unsure", exact: true }).click();
  await expect(
    movieCard.getByText("Needs confirmation", { exact: true }),
  ).toBeVisible();
  await expect(movieCard.getByText("8/10", { exact: true })).toBeVisible();
  expect(
    (
      await db
        .from("watch_entries")
        .select("status,rating,notes,confirmation_needed")
        .eq("title_id", id(movie))
        .single()
    ).data,
  ).toMatchObject({
    status: "watched",
    rating: 8,
    notes: "Temporary fixture reaction",
    confirmation_needed: true,
  });
  await page
    .getByRole("group", { name: "Watch Audit filters" })
    .getByRole("button", { name: "All titles", exact: true })
    .click();
  await page.getByRole("searchbox", { name: "Find a title" }).fill(series);
  const seriesCard = page
    .locator(".audit-card")
    .filter({ has: page.getByRole("heading", { name: series, exact: true }) });
  await seriesCard.locator(".audit-seasons > summary").click();
  await seriesCard
    .locator(".audit-season")
    .getByRole("button", { name: "Watching", exact: true })
    .click();
  await expect(
    seriesCard.locator(".audit-season").getByRole("status"),
  ).toHaveText("Watch status confirmed.");
  expect(
    (
      await db
        .from("seasons")
        .select("status,rating,notes")
        .eq("title_id", id(series))
        .eq("number", 1)
        .single()
    ).data,
  ).toMatchObject({
    status: "watching",
    rating: 8,
    notes: "Keep this season reaction",
  });
  mkdirSync("artifacts/v2.2", { recursive: true });
  await page.screenshot({
    caret: "initial",
    path: `artifacts/v2.2/audit-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/plan");
  await page.getByText("Add a watch to your plan", { exact: true }).click();
  const add = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add to plan", exact: true }),
  });
  await add
    .getByRole("combobox", { name: "Choose a title", exact: true })
    .selectOption(id(series));
  await add.getByLabel("Watch scope").selectOption("1");
  await add.getByLabel("Plan week").selectOption("1");
  await add.getByRole("button", { name: "Add to plan", exact: true }).click();
  const seriesPlan = page
    .locator(".plan-card")
    .filter({ has: page.getByRole("heading", { name: series, exact: true }) });
  await expect(seriesPlan).toBeVisible();
  await add
    .getByRole("combobox", { name: "Choose a title", exact: true })
    .selectOption(id(movie));
  await add.getByLabel("Plan week").selectOption("2");
  await add.getByRole("button", { name: "Add to plan", exact: true }).click();
  const moviePlan = page
    .locator(".plan-card")
    .filter({ has: page.getByRole("heading", { name: movie, exact: true }) });
  await expect(moviePlan).toBeVisible();
  await moviePlan.getByRole("button", { name: "Move up", exact: true }).click();
  await expect(
    page
      .locator(".plan-week")
      .filter({ has: page.getByText("WEEK 1", { exact: true }) })
      .getByRole("heading", { name: movie, exact: true }),
  ).toBeVisible();
  const parentBefore = (
    await db
      .from("watch_entries")
      .select("status")
      .eq("title_id", id(series))
      .single()
  ).data;
  await seriesPlan
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await expect(seriesPlan.locator(".eyebrow")).toContainText("completed");
  expect(
    (
      await db
        .from("watch_entries")
        .select("status")
        .eq("title_id", id(series))
        .single()
    ).data,
  ).toEqual(parentBefore);
  expect(
    (
      await db
        .from("seasons")
        .select("status")
        .eq("title_id", id(series))
        .eq("number", 1)
        .single()
    ).data?.status,
  ).toBe("watched");
  await moviePlan
    .getByRole("button", { name: "Postpone", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "For another time" }),
  ).toBeVisible();
  await moviePlan.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(moviePlan).toHaveCount(0);
  expect(
    (
      await db
        .from("watch_entries")
        .select("status")
        .eq("title_id", id(movie))
        .single()
    ).data?.status,
  ).toBe("watched");
  await seriesPlan.getByText("Reschedule or replace", { exact: true }).click();
  const replacement = seriesPlan.locator("form").filter({
    has: page.getByRole("button", {
      name: "Replace with this pick",
      exact: true,
    }),
  });
  await replacement
    .getByRole("combobox", { name: "Choose a title", exact: true })
    .selectOption(id(pick));
  await replacement
    .getByRole("button", { name: "Replace with this pick", exact: true })
    .click();
  await expect(
    page
      .locator(".plan-card")
      .filter({ has: page.getByRole("heading", { name: pick, exact: true }) }),
  ).toBeVisible();
  await page.screenshot({
    caret: "initial",
    path: `artifacts/v2.2/plan-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/settings/sync");
  await expect(
    page.getByRole("heading", { name: "Update from ChatGPT" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Recommendation Pack JSON", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy Context", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download context", exact: true }),
  ).toBeVisible();
  await page.locator(".sync-wizard > summary").click();
  await expect(page.locator(".sync-wizard input[type=file]")).toBeVisible();
  await expect(page.locator(".sync-wizard textarea")).toHaveCount(0);
  await page.screenshot({
    caret: "initial",
    path: `artifacts/v2.2/sync-${info.project.name}.png`,
    fullPage: true,
  });
  for (const url of ["/audit", "/plan", "/settings/sync", "/"]) {
    await page.goto(url);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("Available time").selectOption("Under 2 hours");
  await page
    .getByRole("combobox",{name:"Mood",exact:true})
    .selectOption("Police investigation");
  await page.getByLabel("Movie or series?").selectOption("Movie");
  await expect(page.locator(".tonight-picker .cinema-hero")).toBeVisible();
  await page.locator(".scoring-explanation > summary").click();
  await expect(page.getByText(/This is not machine learning/)).toBeVisible();
  await page.screenshot({
    caret: "initial",
    path: `artifacts/v2.2/tonight-${info.project.name}.png`,
    fullPage: true,
  });
});
