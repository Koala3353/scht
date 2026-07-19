import { expect, test } from "playwright/test";

// Opt in only with PLAYWRIGHT_TASK_FIXTURE=1 plus PLAYWRIGHT_STORAGE_STATE pointing
// to an authenticated student session with a current term and writable Supabase data.
// CI intentionally supplies neither secret nor storage state.
const hasAuthenticatedFixture =
  process.env.PLAYWRIGHT_TASK_FIXTURE === "1" && Boolean(process.env.PLAYWRIGHT_STORAGE_STATE);

test.skip(!hasAuthenticatedFixture, "Requires explicit authenticated task-sync browser fixtures.");

test("a detailed task created offline reconnects as exactly one synced task", async ({ page, context }) => {
  const title = `Offline field report ${Date.now()}`;

  await page.goto("/today");
  await expect(page.getByText("Quick capture")).toBeVisible();
  await context.setOffline(true);

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("No deadline").uncheck();
  await page.getByLabel("Due date and time").fill("2026-08-12T09:15");
  await page.getByLabel("Description").fill("Reconnect regression coverage.");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByLabel("Effort (minutes)").fill("45");
  await page.getByLabel("Grade impact (%)").fill("20");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByText(title)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Synced", { exact: true })).toBeVisible();
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: title })).toHaveCount(1);
});
