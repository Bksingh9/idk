import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const ART = "tests/e2e/artifacts";
mkdirSync(ART, { recursive: true });

const stamp = Date.now();
const devEmail = `e2e-dev-${stamp}@example.com`;
const testerEmail = `e2e-tester-${stamp}@example.com`;
const PASSWORD = "password123";

test.describe.configure({ mode: "serial" });

test("landing shows both signup CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PlaytestPool" })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up as developer/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up as tester/i })).toBeVisible();
  await page.screenshot({ path: `${ART}/01-landing.png`, fullPage: true });
});

test("developer signup lands on developer dashboard", async ({ page }) => {
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(devEmail);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Dana Dev");
  await page.getByLabel("Country (optional)").fill("US");
  await page.screenshot({ path: `${ART}/02-dev-signup-filled.png`, fullPage: true });
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL("**/dashboard/developer");
  await expect(page.getByRole("heading", { name: /developer dashboard/i })).toBeVisible();
  await expect(page.getByText(/Welcome, Dana Dev/)).toBeVisible();
  await expect(page.getByText(/Plan:/)).toContainText("free");
  await page.screenshot({ path: `${ART}/03-dev-dashboard.png`, fullPage: true });
});

test("logout then login returns developer to their dashboard", async ({ page }) => {
  // Establish a session by logging in (fresh context each test).
  await page.goto("/login");
  await page.getByLabel("Email").fill(devEmail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard/developer");
  await expect(page.getByRole("heading", { name: /developer dashboard/i })).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
});

test("tester signup with genre/platform chips lands on tester dashboard", async ({ page }) => {
  await page.goto("/signup?role=tester");
  await page.getByLabel("Email").fill(testerEmail);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Tess Tester");
  await page.getByLabel("Country (optional)").fill("CA");

  // Toggle chips (they're buttons with the option label).
  await page.getByRole("button", { name: "RPG", exact: true }).click();
  await page.getByRole("button", { name: "Puzzle", exact: true }).click();
  await page.getByRole("button", { name: "Windows", exact: true }).click();
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await page.getByLabel(/languages/i).fill("English, French");
  await page.getByLabel(/experience level/i).selectOption("experienced");
  await page.screenshot({ path: `${ART}/04-tester-signup-filled.png`, fullPage: true });

  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/tester");
  await expect(page.getByRole("heading", { name: /tester dashboard/i })).toBeVisible();
  await expect(page.getByText(/Welcome, Tess Tester/)).toBeVisible();
  // Reputation + tags rendered.
  await expect(page.getByText("Reputation")).toBeVisible();
  await expect(page.getByText("RPG, Puzzle")).toBeVisible();
  await page.screenshot({ path: `${ART}/05-tester-dashboard.png`, fullPage: true });
});

test("role guard: tester visiting developer dashboard is redirected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(testerEmail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard/tester");

  await page.goto("/dashboard/developer");
  await page.waitForURL("**/dashboard/tester");
  await expect(page.getByRole("heading", { name: /tester dashboard/i })).toBeVisible();
});

test("unauthenticated visit to /dashboard redirects to login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/dashboard");
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
});
