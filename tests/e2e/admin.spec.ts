import { test, expect, type Page } from "@playwright/test";

const stamp = Date.now();
const PASSWORD = "password123";
const ADMIN = "admin-e2e@example.com"; // in ADMIN_EMAILS for the test env

test.describe.configure({ mode: "serial" });

async function signupTester(page: Page, email: string, name: string) {
  await page.goto("/signup?role=tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "RPG", exact: true }).click();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/tester");
}

async function ensureAdminLoggedIn(page: Page) {
  // Login if the admin account already exists (from a prior run); else sign up.
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  try {
    await page.waitForURL("**/dashboard/**", { timeout: 4000 });
    return;
  } catch {
    /* needs signup */
  }
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(ADMIN);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Operator");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");
}

test("non-admin is denied the admin view (404)", async ({ page }) => {
  const dev = `nonadmin-${stamp}@example.com`;
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(dev);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Nosy Dev");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");

  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("admin can see tester reputation and deactivate a flaky tester", async ({ page }) => {
  const testerEmail = `flaky-${stamp}@example.com`;
  await signupTester(page, testerEmail, `Flaky ${stamp}`);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");

  await ensureAdminLoggedIn(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /admin · testers/i })).toBeVisible();

  const row = page.locator("tr", { hasText: testerEmail });
  await expect(row).toContainText("active");
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/admin/testers/") && r.request().method() === "POST"),
    row.getByRole("button", { name: /deactivate/i }).click(),
  ]);
  expect(resp.status()).toBe(200);
  await expect(row).toContainText("inactive");
});
