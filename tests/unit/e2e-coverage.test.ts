import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

// Spec §15 E2E list → the test that proves it. If a spec retitles a test,
// update the title here to the real one (never drop a row).
const SPEC_15 = [
  {
    item: "sign-in per role",
    file: "roles.spec.ts",
    title: "signs in and sees exactly its menu",
  },
  {
    item: "invite → set password",
    file: "admin-auth.spec.ts",
    title: "set-password flow works with an invite token",
  },
  {
    item: "reset",
    file: "password-reset.spec.ts",
    title: "forgot password → reset link → new password → sign in",
  },
  { item: "2FA enable", file: "account.spec.ts", title: "turn on 2FA" },
  { item: "2FA disable", file: "account.spec.ts", title: "turn 2FA off" },
  {
    item: "edit + publish page → visible on site",
    file: "page-editor.spec.ts",
    title: "edit hero heading → autosave → preview → publish → public site",
  },
  {
    item: "author cannot publish",
    file: "articles.spec.ts",
    title: "author drafts and submits, cannot publish via the API",
  },
  {
    item: "author vs others' articles via the API (Review Focus 5)",
    file: "roles.spec.ts",
    title: "the API refuses publishing and editing someone else's article",
  },
  {
    item: "intake sees only leads",
    file: "roles.spec.ts",
    title: "signs in and sees exactly its menu",
  },
  {
    item: "contact form → lead (+ staff notification outcome)",
    file: "leads.spec.ts",
    title:
      "public enquiry → lead in the intake inbox, worked by the intake user",
  },
  {
    item: "media upload",
    file: "media.spec.ts",
    title:
      "library upload → hero image in the page editor → publish → public home",
  },
  {
    item: "redirect works",
    file: "seo.spec.ts",
    title: "a manual redirect answers 301 and counts its hit",
  },
  {
    item: "auth endpoints rate limited",
    file: "admin-auth.spec.ts",
    title: "sign-in is rate limited in production",
  },
  {
    item: "security headers",
    file: "security-headers.spec.ts",
    title: "sends the hardening headers",
  },
] as const

describe("spec §15 E2E coverage", () => {
  it.each(SPEC_15)("$item → $file", ({ file, title }) => {
    expect(readFileSync(join("tests/e2e", file), "utf8")).toContain(title)
  })
})
