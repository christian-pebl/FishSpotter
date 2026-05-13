import { Page, expect } from "@playwright/test";

/** Generate a unique test email each run to avoid sign-in collisions. */
export function freshEmail() {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `pw-${stamp}@bideford.test`;
}

/** Sign up a new account via the UI. */
export async function signUpFresh(page: Page, email = freshEmail(), name = "PW Tester") {
  await page.goto("/auth/signin");
  await page.getByRole("button", { name: /No account\? Sign up/i }).click();
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Display name$/i).fill(name);
  await page.getByRole("button", { name: /Create account/i }).click();
  await expect(page).toHaveURL(/\/feed/);
  return { email, name };
}

/**
 * Find a Snippet of the requested label-status via the API and return its id.
 * Uses the public /api/snippets endpoint.
 */
export async function findClipByStatus(
  request: import("@playwright/test").APIRequestContext,
  status: "STAFF_LABELLED" | "UNLABELLED",
  options: { staffTaxonScientific?: string } = {},
) {
  const list = await (await request.get("/api/snippets")).json();
  const matches = list.filter((s: any) => s.labelStatus === status);
  if (matches.length === 0) throw new Error(`No clip with status=${status}`);
  return matches[0]; // simplest: first match
}

/** Submit an answer on the snippet's detail page (uses SnippetPlayer). */
export async function answerSnippet(page: Page, snippetId: string, text: string) {
  await page.goto(`/feed/${snippetId}`);
  await page.getByPlaceholder("Type species name").fill(text);
  await page.getByRole("button", { name: /Confirm selection/i }).click();
}

/** Try to find the staff-taxon for a snippet (used to compose a guaranteed-correct answer). */
export async function getStaffTaxonForSnippet(
  request: import("@playwright/test").APIRequestContext,
  snippetId: string,
) {
  const r = await request.get(`/api/snippets/${snippetId}/stats`);
  const body = await r.json();
  return body.staffTaxon as { id: string; name: string; scientificName: string | null } | null;
}
