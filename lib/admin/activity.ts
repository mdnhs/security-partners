import {
  SETTINGS_ENTRIES,
  isEditableSettingsKey,
} from "@/lib/admin/settings-keys"

type Tone = "success" | "warning" | "danger" | "info" | "neutral"
export type ActivitySummary = {
  text: string
  status?: { label: string; tone: Tone }
}

const FIXED: Record<string, ActivitySummary> = {
  "auth.sign_in": {
    text: "signed in",
    status: { label: "Signed in", tone: "success" },
  },
  "auth.sign_out": { text: "signed out" },
  "newsletter.looked_up": {
    text: "checked an address against the newsletter list",
  },
  "newsletter.exported": { text: "exported the newsletter list" },
  "newsletter.purged": { text: "removed unconfirmed newsletter sign-ups" },
  "auth.sign_in_failed": {
    text: "failed to sign in",
    status: { label: "Failed", tone: "danger" },
  },
  "auth.password_reset": { text: "reset their password" },
  "auth.password_change": { text: "changed their password" },
  "auth.2fa_enable": { text: "turned on two-factor authentication" },
  "auth.2fa_disable": { text: "turned off two-factor authentication" },
  "user.invite": {
    text: "invited a user",
    status: { label: "Invited", tone: "info" },
  },
  "user.update": { text: "updated a user" },
  "user.roles_change": { text: "changed a user's roles" },
  "user.ban": {
    text: "banned a user",
    status: { label: "Banned", tone: "danger" },
  },
  "user.unban": { text: "unbanned a user" },
  "user.sessions_revoke": { text: "signed out a user's devices" },
  "user.password_link": { text: "created a password link" },
  "user.owner_recover": { text: "recovered the owner account" },
  "user.impersonate_start": { text: "started viewing as another user" },
  "user.impersonate_stop": { text: "stopped viewing as another user" },
  "service.slug_changed": { text: "changed a service's address" },
  // Articles workflow (Phase 5); created, draft_saved, published, restored
  // and deleted read like every other record's below.
  "article.submitted": {
    text: "submitted an article for review",
    status: { label: "In review", tone: "info" },
  },
  "article.scheduled": {
    text: "scheduled an article",
    status: { label: "Scheduled", tone: "info" },
  },
  "article.unscheduled": { text: "cancelled an article's schedule" },
  "article.unpublished": {
    text: "took an article off the site",
    status: { label: "Unpublished", tone: "neutral" },
  },
  "article.meta_changed": {
    text: "changed an article's address, category or byline",
  },
}

const SINGULAR: Record<string, string> = {
  service: "a service",
  team: "a team member",
  client: "a client",
  groupCompany: "a group company",
  category: "a category",
  article: "an article",
  media: "a file",
  newsletter: "a newsletter subscriber",
}

const PLURAL: Record<string, string> = {
  services: "services",
  team: "the team",
  clients: "clients",
  "group-companies": "group companies",
  categories: "categories",
}

function subject(entityType: string | null, entityId: string | null): string {
  if (entityType === "page" && entityId) return `the ${entityId} page`
  if (entityType === "settings" && entityId)
    return isEditableSettingsKey(entityId)
      ? `${SETTINGS_ENTRIES[entityId].label} settings`
      : `${entityId} settings`
  return (entityType && SINGULAR[entityType]) ?? "a record"
}

/** One audit row as "who did what" words and an optional status pill. */
export function describeActivity(item: {
  action: string
  entityType: string | null
  entityId: string | null
}): ActivitySummary {
  const fixed = FIXED[item.action]
  if (fixed) return fixed
  const dot = item.action.lastIndexOf(".")
  const verb = dot === -1 ? "" : item.action.slice(dot + 1)
  const what = subject(item.entityType, item.entityId)
  switch (verb) {
    case "published":
      return {
        text: `published ${what}`,
        status: { label: "Published", tone: "success" },
      }
    case "draft_saved":
      return {
        text: `saved a draft of ${what}`,
        status: { label: "Draft", tone: "neutral" },
      }
    case "restored":
      return { text: `restored a version of ${what}` }
    case "created":
      return { text: `added ${what}` }
    case "updated":
      return { text: `edited ${what}` }
    case "deleted":
      return { text: `deleted ${what}` }
    case "reordered":
      return {
        text: `reordered ${(item.entityType && PLURAL[item.entityType]) ?? "a list"}`,
      }
    default:
      return { text: item.action }
  }
}
