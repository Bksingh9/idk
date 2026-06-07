import { test, expect, type Page } from "@playwright/test";

const stamp = Date.now();
const PASSWORD = "password123";

test.describe.configure({ mode: "serial" });

async function signupDeveloper(page: Page, email: string) {
  await page.goto("/signup?role=developer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Dev");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/developer");
}

async function signupTester(page: Page, email: string, genre: string) {
  await page.goto("/signup?role=tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (min 8 chars)").fill(PASSWORD);
  await page.getByLabel("Display name").fill("Tester");
  await page.getByLabel("Country (optional)").fill("US");
  await page.getByRole("button", { name: genre, exact: true }).click();
  await page.getByRole("button", { name: "Web", exact: true }).click();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/dashboard/tester");
}

async function postProject(page: Page, title: string, genre: string) {
  await page.goto("/projects/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Please test this.");
  await page.getByLabel(/platform \(the build runs on\)/i).selectOption("Web");
  await page.getByRole("button", { name: genre, exact: true }).click(); // target genre
  await page.getByRole("button", { name: "Web", exact: true }).click(); // target platform
  await page.getByLabel(/target countries/i).fill("US");
  await page.getByRole("button", { name: /post project/i }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+$/);
}

async function logout(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.waitForURL("**/login");
}

test("matching invites an eligible tester, who accepts", async ({ page }) => {
  const tester = `m-tester-${stamp}@example.com`;
  const dev = `m-dev-${stamp}@example.com`;

  // Tester exists first so matching at post-time can find them.
  await signupTester(page, tester, "RPG");
  await logout(page);

  await signupDeveloper(page, dev);
  await postProject(page, "Matched Game", "RPG");
  await logout(page);

  // Tester sees the invitation and accepts.
  await page.goto("/login");
  await page.getByLabel("Email").fill(tester);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/dashboard/tester");

  await expect(page.getByRole("heading", { name: /invitations/i })).toBeVisible();
  await expect(page.getByText("Matched Game")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();

  // Moves to "Projects you're testing" with a feedback CTA.
  await expect(
    page.getByRole("heading", { name: /projects you're testing/i })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /give feedback/i })).toBeVisible();
});

test("tester can browse an open project posted before them and opt in", async ({ page }) => {
  const dev = `b-dev-${stamp}@example.com`;
  const tester = `b-tester-${stamp}@example.com`;

  const title = `Browseable Puzzle ${stamp}`;
  // Developer posts a Puzzle project while no matching tester exists yet.
  await signupDeveloper(page, dev);
  await postProject(page, title, "Puzzle");
  await logout(page);

  // Tester signs up after → not auto-invited, but eligible via browse.
  await signupTester(page, tester, "Puzzle");
  await page.goto("/browse");
  const row = page.locator("li", { hasText: title });
  await expect(row).toBeVisible();
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/opt-in") && r.request().method() === "POST"),
    row.getByRole("button", { name: /opt in/i }).click(),
  ]);
  expect(resp.status()).toBe(201);

  await page.goto("/dashboard/tester");
  await expect(
    page.getByRole("heading", { name: /projects you're testing/i })
  ).toBeVisible();
  await expect(page.locator("li", { hasText: title })).toBeVisible();
});
