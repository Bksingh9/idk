import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ART = "tests/e2e/artifacts";
mkdirSync(ART, { recursive: true });

const stamp = Date.now();
const PASSWORD = "password123";
const tester = `f-tester-${stamp}@example.com`;
const dev = `f-dev-${stamp}@example.com`;
const TITLE = `Full Loop ${stamp}`;

test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string, role: "developer" | "tester") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(`**/dashboard/${role}`);
}

async function logout(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
}

test("full loop: post → match → accept → feedback → rating → reputation", async ({ page }) => {
  test.setTimeout(120_000); // heavy multi-role flow; dev compiles many routes first-hit
  // Tester first so matching finds them.
  await page.goto("/signup?role=tester");
  await page.getByLabel("Email").fill(tester);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Loop Tester");
  await page.getByLabel("Country (optional)").fill("US");
  await page.getByRole("button", { name: "RPG", exact: true }).click();
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/tester");
  await logout(page);

  // Developer posts a matching project.
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(dev);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Loop Dev");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");

  await page.goto("/projects/new");
  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel("Description").fill("Full loop test build.");
  await page.getByLabel(/platform \(the build runs on\)/i).selectOption("Web");
  await page.getByRole("button", { name: "RPG", exact: true }).click();
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await page.getByLabel(/target countries/i).fill("US");
  await page.getByRole("button", { name: /post project/i }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
  const projectUrl = page.url();
  await logout(page);

  // Tester accepts and submits feedback.
  await login(page, tester, "tester");
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("link", { name: /give feedback/i }).click();
  await page.waitForURL(/\/feedback\//);
  await page.getByRole("button", { name: "5", exact: true }).click(); // fun rating 5
  await page.getByRole("radio", { name: "yes" }).check();
  await page.getByLabel("Where did you drop off?").fill("Level 3 boss");
  await page.getByLabel("General comments").fill("Great pacing overall.");
  await page.getByRole("button", { name: /submit feedback/i }).click();
  await page.waitForURL("**/dashboard/tester");
  await expect(page.getByText(/feedback submitted/i)).toBeVisible();
  await logout(page);

  // Developer sees feedback + aggregate, and rates it 5 stars.
  await login(page, dev, "developer");
  await page.goto(projectUrl);
  await expect(page.getByText("Responses")).toBeVisible();
  await expect(page.getByText("Level 3 boss").first()).toBeVisible();
  await page.screenshot({ path: `${ART}/09-feedback-aggregate.png`, fullPage: true });
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/rating") && r.request().method() === "POST"),
    page.getByRole("button", { name: "5 stars" }).click(),
  ]);
  expect(resp.status()).toBe(200);
  await logout(page);

  // Tester reputation = 5 (submit) + 4 (5-star bonus) = 9.
  await login(page, tester, "tester");
  const repCard = page.locator("div", { hasText: /^Reputation/ }).first();
  await expect(repCard).toContainText("9");
});
