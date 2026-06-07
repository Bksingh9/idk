import { test, expect, type Page } from "@playwright/test";

const stamp = Date.now();
const PASSWORD = "password123";
const dev = `bill-dev-${stamp}@example.com`;

test.describe.configure({ mode: "serial" });

async function postProject(page: Page, title: string) {
  await page.goto("/projects/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Gating test.");
  await page.getByLabel(/platform \(the build runs on\)/i).selectOption("Web");
  await page.getByRole("button", { name: /post project/i }).click();
}

test("free plan gates project creation to 1 active project", async ({ page }) => {
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(dev);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Bill Dev");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");

  // First project succeeds.
  await postProject(page, `Gate One ${stamp}`);
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/);

  // Second active project is blocked with a clear upgrade message.
  await postProject(page, `Gate Two ${stamp}`);
  await expect(page.getByText(/Free plan allows 1 active project/i)).toBeVisible();

  // Billing page reflects the free plan + usage, and notes billing is unconfigured.
  await page.goto("/billing");
  await expect(page.getByText(/current plan/i)).toBeVisible();
  await expect(page.getByText("1 / 1 active projects used")).toBeVisible();
  await expect(page.getByText(/billing is not configured/i)).toBeVisible();
});

test("closing the active project frees the slot to post again", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(dev);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard/developer");

  // Open the first project and close it.
  await page.getByRole("link", { name: `Gate One ${stamp}` }).click();
  await page.waitForURL(/\/projects\//);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/projects/") && r.request().method() === "PATCH"),
    page.getByRole("button", { name: /close project/i }).click(),
  ]);
  expect(resp.status()).toBe(200);

  // Now a new project can be posted.
  await postProject(page, `Gate Three ${stamp}`);
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: `Gate Three ${stamp}` })).toBeVisible();
});
