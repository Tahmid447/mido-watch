import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const users: { email: string; password: string }[] = existsSync(
  ".env.test-users.json",
)
  ? JSON.parse(readFileSync(".env.test-users.json", "utf8"))
  : [];
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
test("cinematic artwork, private trailers, provider attribution and mobile layouts", async ({
  page,
}, info) => {
  test.skip(!users.length, "Requires disposable hosted test accounts.");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const auth = await db.auth.signInWithPassword(users[0]);
  expect(auth.error).toBeNull();
  const name = `Cinematic fixture ${info.project.name}`;
  const old = await db
    .from("titles")
    .select("id")
    .eq("title", name)
    .maybeSingle();
  const metadata = {
    state: "matched",
    refreshed_at: "2026-10-10T12:00:00Z",
    poster_path: "/fixture-poster.jpg",
    backdrop_path: "/fixture-backdrop.jpg",
    genres: ["Mystery"],
    runtime_minutes: 110,
    original_language: "ja",
    trailer: {
      key: "abcdefghijk",
      name: "Official fixture trailer",
      site: "YouTube",
      official: true,
    },
  };
  let id = old.data?.id;
  if (!id) {
    const r = await db.rpc("import_library", {
      payload: {
        version: 2,
        titles: [
          {
            title: name,
            media_type: "movie",
            release_year: 2026,
            country: "Japan",
            metadata,
            watch: { status: "interested", priority: 95 },
          },
        ],
        taste: [],
      },
    });
    expect(r.error).toBeNull();
    id = (await db.from("titles").select("id").eq("title", name).single()).data!
      .id;
  }
  const prov = await db
    .from("availability")
    .select("id")
    .eq("title_id", id)
    .eq("provider", "Fixture provider");
  if (!prov.data?.length)
    expect(
      (
        await db.from("availability").insert({
          title_id: id,
          region: "JP",
          provider: "Fixture provider",
          kind: "subscription",
          origin: "tmdb",
          logo_path: "/fixture-logo.jpg",
          fetched_at: "2026-10-10T12:00:00Z",
          source_url: "https://www.themoviedb.org",
        })
      ).error,
    ).toBeNull();
  await page.route("https://image.tmdb.org/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#333d45"/></svg>',
    }),
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Isolated trailer player fixture</p>",
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto(`/titles/${id}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  const trailer = page.getByRole("button", {
    name: "Watch Trailer",
    exact: true,
  });
  await trailer.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie.*autoplay=0/,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(trailer).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Availability powered by JustWatch" }),
  ).toBeVisible();
  await expect(page.locator(".detail-hero-poster img")).toHaveAttribute(
    "srcset",
    /w342.*w500.*w780/,
  );
  await expect(page.locator(".detail-hero .pick-level")).toBeVisible();
  for (const url of [
    "/",
    `/library?q=${encodeURIComponent(name)}`,
    `/titles/${id}`,
    "/recommendations",
    "/settings/sync",
    "/settings/metadata",
  ]) {
    await page.goto(url);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(`/titles/${id}`);
  await page.screenshot({
    path: `test-results/cinematic-${info.project.name}.png`,
    fullPage: true,
  });
  await page.unroute("https://image.tmdb.org/**");
  await page.route("https://image.tmdb.org/**", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".detail-hero-poster .art-fallback")).toBeVisible();
});
