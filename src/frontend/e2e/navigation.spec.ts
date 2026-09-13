import { test, expect } from "@playwright/test";

test.describe("Unauthenticated navigation", () => {
  test("loads the login page", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /sign in/i })
    ).toBeVisible();

    await expect(
      page.getByText(/formula 1 analytics/i)
    ).toBeVisible();
  });

  test("shows email and password fields", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("shows sign in controls", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /^sign in$/i })
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();
  });

  test("shows password reset option", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText(/forgot password/i)
    ).toBeVisible();
  });

  test("shows registration option", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText(/register/i)
    ).toBeVisible();
  });
});