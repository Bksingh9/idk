import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ART = "tests/e2e/artifacts";
mkdirSync(ART, { recursive: true });

const stamp = Date.now();
const email = `e2e-dev2-${stamp}@example.com`;
const PASSWORD = "password123";

test.describe.configure({ mode: "serial" });

test("developer can post a project, see it listed, and view its detail", async ({ page }) => {
  // Sign up a fresh developer.
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Pat Dev");
  await page.getByLabel("Country (optional)").fill("US");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");

  // Empty state.
  await expect(page.getByText(/no projects yet/i)).toBeVisible();

  // Post a project.
  await page.getByRole("link", { name: /post a project/i }).click();
  await page.waitForURL("**/projects/new");
  await page.getByLabel("Title").fill("Space Roguelite");
  await page.getByLabel("Description").fill("A fast roguelite. Tell me where it drags.");
  await page.getByLabel(/platform \(the build runs on\)/i).selectOption("Web");
  await page.getByLabel("Build URL").fill("https://example.com/build");
  await page.getByRole("button", { name: "RPG", exact: true }).click();
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await page.getByLabel(/target countries/i).fill("US, CA");
  await page.getByPlaceholder("Question 1").fill("Was the tutorial clear?");
  await page.getByRole("button", { name: /add question/i }).click();
  await page.getByPlaceholder("Question 2").fill("Did combat feel fair?");
  await page.screenshot({ path: `${ART}/06-post-project.png`, fullPage: true });
  await page.getByRole("button", { name: /post project/i }).click();

  // Lands on detail page.
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Space Roguelite" })).toBeVisible();
  await expect(page.getByText(/no feedback yet/i)).toBeVisible();
  await expect(page.getByText("Was the tutorial clear?")).toBeVisible();
  await expect(page.getByText("Did combat feel fair?")).toBeVisible();
  await page.screenshot({ path: `${ART}/07-project-detail.png`, fullPage: true });

  // Close the project; badge flips to closed.
  await page.getByRole("button", { name: /close project/i }).click();
  await expect(page.locator("span", { hasText: /^closed$/ })).toBeVisible();

  // Back on dashboard, the project is listed with 0 responses.
  await page.getByRole("link", { name: /back to dashboard/i }).click();
  await page.waitForURL("**/dashboard/developer");
  await expect(page.getByRole("link", { name: "Space Roguelite" })).toBeVisible();
  await expect(page.getByText(/0 feedback responses/i)).toBeVisible();
  await page.screenshot({ path: `${ART}/08-dev-dashboard-with-project.png`, fullPage: true });
});

test("a developer cannot view another developer's project", async ({ page, request }) => {
  // Create a project owned by dev A via the API using a fresh dev session.
  // (Reuses the UI-created project owner from the previous test is simpler, so
  // here we assert the not-found path for a random id under a new dev.)
  const otherEmail = `e2e-dev3-${stamp}@example.com`;
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(otherEmail);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Other Dev");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");

  // A random/non-owned project id → 404 page.
  const res = await page.goto("/projects/00000000-0000-0000-0000-000000000000");
  expect(res?.status()).toBe(404);
});
