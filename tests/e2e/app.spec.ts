import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
const users: { email: string; password: string }[] = existsSync(
  ".env.test-users.json",
)
  ? JSON.parse(readFileSync(".env.test-users.json", "utf8"))
  : [];
test("logged-out pages never expose private records", async ({
  page,
  request,
}) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Maharaja")).toHaveCount(0);
  const context = await request.get("/api/export/chatgpt");
  expect([401, 503]).toContain(context.status());
  const response = await request.get("/api/export");
  expect([401, 503]).toContain(response.status());
  await page.screenshot({ path: "test-results/login.png", fullPage: true });
});
test("complete personal watch workflow", async ({ page }, testInfo) => {
  test.skip(
    !users.length,
    "Requires disposable local/hosted test users; see README.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(users[0].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/settings");
  await page
    .getByRole("button", { name: "Import preserved V1 history" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    /Imported (44|0) titles/,
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make tonight a good one." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/library");
  await page.getByRole("textbox", { name: "Search library" }).fill("Reacher");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".title-card")).toHaveCount(3);
  await page
    .getByRole("heading", { name: "Reacher", exact: true })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "Season journal" }),
  ).toBeVisible();
  const season = page
    .locator("details.season")
    .filter({ has: page.locator("summary").filter({ hasText: "Season 4 ·" }) });
  await season.locator("summary").click();
  await season.getByLabel("Watch status").selectOption("watching");
  await season.getByLabel("Your rating").fill("8");
  await season.getByLabel("Season notes").fill("E2E season note");
  await season.getByRole("button", { name: "Save season" }).click();
  await expect(season.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await expect(
    page.locator("summary").filter({ hasText: "Season 4 · watching" }),
  ).toBeVisible();
  const journal = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Watch journal", exact: true }),
  });
  await journal
    .locator("summary")
    .filter({ hasText: "Edit your journal" })
    .click();
  await journal.getByLabel("Your rating").fill("9");
  await journal
    .getByLabel("Your notes")
    .fill("E2E personal rating stays separate");
  await journal.getByRole("button", { name: "Save changes" }).click();
  await expect(journal.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await journal
    .locator("summary")
    .filter({ hasText: "Edit your journal" })
    .click();
  await expect(journal.getByLabel("Your notes")).toHaveValue(
    "E2E personal rating stays separate",
  );
  const rec = page.locator("details.panel").filter({
    has: page
      .locator("summary")
      .filter({ hasText: /Add a recommendation|Edit recommendation/ }),
  });
  await rec.locator(":scope > summary").click();
  await rec
    .getByLabel("Spoiler-free reason")
    .fill("A compelling investigation");
  await rec.getByLabel("Why it fits your taste").fill("Competent protagonist");
  await rec.getByRole("button", { name: "Save changes" }).click();
  await expect(rec.getByRole("status")).toHaveText("Saved.");
  const availability = page.locator("details.panel").filter({
    has: page
      .locator("summary")
      .filter({ hasText: "Add regional availability" }),
  });
  await availability.locator("summary").click();
  await availability.getByLabel("Provider / cinema").fill("E2E provider");
  await availability.getByLabel("Availability type").selectOption("rent");
  await availability.getByRole("button", { name: "Save changes" }).click();
  await expect(availability.getByRole("status")).toHaveText("Saved.");
  const review = page.locator("details.panel").filter({
    has: page
      .locator("summary")
      .filter({ hasText: "Add external review evidence" }),
  });
  await review.locator("summary").click();
  await review.getByLabel("Source / reviewer").fill("E2E unverified source");
  await review.getByLabel("Score · as published").fill("7/10");
  await review.getByRole("button", { name: "Save changes" }).click();
  await expect(review.getByRole("status")).toHaveText("Saved.");
  await page.screenshot({
    path: `test-results/detail-${testInfo.project.name}.png`,
    fullPage: false,
  });
  await page.goto("/recommendations");
  await expect(page.getByText("Competent protagonist")).toBeVisible();
  await page.goto("/settings/sync");
  const pack = {
    schema_version: 1,
    generated_at: "2026-10-09T09:00:00Z",
    recommendations: [
      {
        title: `Friday fixture ${testInfo.project.name} ${Date.now()}`,
        media_type: "movie",
        priority: 95,
        reason: "A precise mystery",
        fit: "Competent protagonist",
        caveat: "A patient opening",
        reviews: [],
        availability: [],
      },
    ],
  };
  await page
    .getByLabel("Recommendation Pack JSON", { exact: true })
    .fill(JSON.stringify(pack));
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your Friday picks" }),
  ).toBeVisible();
  await expect(
    page.getByText("New inbox title", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Imported 1 new inbox titles",
  );
  await page.goto(
    `/library?q=${encodeURIComponent(pack.recommendations[0].title)}`,
  );
  await expect(page.locator(".title-card")).toHaveCount(0);
  await page.goto("/recommendations");
  const inbox = page.locator(".inbox-card").filter({
    has: page.getByRole("heading", { name: pack.recommendations[0].title }),
  });
  await inbox
    .getByRole("button", { name: "Add to Interested", exact: true })
    .click();
  await expect(inbox).toHaveCount(0);
  await page.goto(
    `/library?q=${encodeURIComponent(pack.recommendations[0].title)}`,
  );
  await expect(page.locator(".title-card")).toHaveCount(1);
  await page.goto("/settings/sync");
  const contextDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export for ChatGPT" }).click();
  const contextPath = await (await contextDownload).path();
  const context = JSON.parse(readFileSync(contextPath!, "utf8"));
  expect(context.schema_version).toBe(1);
  expect(
    context.titles.some(
      (t: { title: string; rating: number }) =>
        t.title === "Reacher" && t.rating === 9,
    ),
  ).toBe(true);
  expect(JSON.stringify(context)).not.toContain("user_id");
  await page.screenshot({
    path: `test-results/sync-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/taste");
  await expect(
    page.getByRole("heading", { name: "Your taste, in focus." }),
  ).toBeVisible();
  const add = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add a taste signal" }) });
  await add.getByLabel("Signal", { exact: true }).fill("E2E dislikes");
  await add.getByLabel("Preference weight").fill("-3");
  await add.getByRole("button", { name: "Save signal" }).click();
  await expect(add.getByRole("status")).toHaveText("Saved.");
  await page.goto("/add");
  const name = `E2E film ${testInfo.project.name}`;
  await page.getByLabel("Title", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add title", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    /Title added|already exists/,
  );
  await page.goto("/settings");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download JSON backup" }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  const backup = JSON.parse(readFileSync(path!, "utf8"));
  expect(backup.version).toBe(2);
  expect(backup.titles.length).toBeGreaterThanOrEqual(45);
  await page.getByLabel("JSON backup").setInputFiles(path!);
  await page
    .getByRole("button", { name: "Import backup", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Imported 0 titles.");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(users[1].email);
  await page.getByLabel("Password", { exact: true }).fill(users[1].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/library");
  await expect(page.locator(".title-card")).toHaveCount(0);
});
