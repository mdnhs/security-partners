import { describe, expect, it } from "vitest"

import { describeActivity } from "@/lib/admin/activity"

const row = (
  action: string,
  entityType: string | null = null,
  entityId: string | null = null
) => ({
  action,
  entityType,
  entityId,
})

describe("describeActivity", () => {
  it.each([
    [
      row("page.published", "page", "home"),
      "published the home page",
      "Published",
      "success",
    ],
    [
      row("page.draft_saved", "page", "about"),
      "saved a draft of the about page",
      "Draft",
      "neutral",
    ],
    [
      row("settings.published", "settings", "footer"),
      "published Footer settings",
      "Published",
      "success",
    ],
    [
      row("newsletter.looked_up", "newsletter", null),
      "checked an address against the newsletter list",
      undefined,
      undefined,
    ],
    [
      row("newsletter.deleted", "newsletter", "x"),
      "deleted a newsletter subscriber",
      undefined,
      undefined,
    ],
    [
      row("service.created", "service", "x"),
      "added a service",
      undefined,
      undefined,
    ],
    [
      row("team.deleted", "team", "x"),
      "deleted a team member",
      undefined,
      undefined,
    ],
    [
      row("clients.reordered", "clients", null),
      "reordered clients",
      undefined,
      undefined,
    ],
    [row("auth.sign_in"), "signed in", "Signed in", "success"],
    [
      row("auth.password_change"),
      "changed their password",
      undefined,
      undefined,
    ],
    [row("auth.sign_in_failed"), "failed to sign in", "Failed", "danger"],
    [
      row("auth.2fa_enable", "user", "u1"),
      "turned on two-factor authentication",
      undefined,
      undefined,
    ],
    [
      row("auth.2fa_disable", "user", "u1"),
      "turned off two-factor authentication",
      undefined,
      undefined,
    ],
    [row("user.invite", "user", "u2"), "invited a user", "Invited", "info"],
    [row("user.ban", "user", "u2"), "banned a user", "Banned", "danger"],
  ])("%o → %s", (item, text, label, tone) => {
    const summary = describeActivity(item)
    expect(summary.text).toBe(text)
    expect(summary.status?.label).toBe(label)
    expect(summary.status?.tone).toBe(tone)
  })

  it.each([
    ["article.created", "added an article", undefined, undefined],
    ["article.draft_saved", "saved a draft of an article", "Draft", "neutral"],
    [
      "article.submitted",
      "submitted an article for review",
      "In review",
      "info",
    ],
    ["article.published", "published an article", "Published", "success"],
    ["article.scheduled", "scheduled an article", "Scheduled", "info"],
    [
      "article.unscheduled",
      "cancelled an article's schedule",
      undefined,
      undefined,
    ],
    [
      "article.unpublished",
      "took an article off the site",
      "Unpublished",
      "neutral",
    ],
    [
      "article.meta_changed",
      "changed an article's address, category or byline",
      undefined,
      undefined,
    ],
    [
      "article.restored",
      "restored a version of an article",
      undefined,
      undefined,
    ],
    ["article.deleted", "deleted an article", undefined, undefined],
  ])("articles (Phase 5): %s → %s", (action, text, label, tone) => {
    const summary = describeActivity(row(action, "article", "x"))
    expect(summary.text).toBe(text)
    expect(summary.status?.label).toBe(label)
    expect(summary.status?.tone).toBe(tone)
  })

  it("falls back to the raw action", () => {
    expect(describeActivity(row("something.odd")).text).toBe("something.odd")
  })
})
