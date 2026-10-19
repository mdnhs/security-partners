import "server-only"

import { tool, type ToolSet } from "ai"
import { z } from "zod"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { searchQuery } from "@/lib/schemas/api/search"
import type { AiConfig } from "@/lib/schemas/integrations"
import type { Actor } from "@/server/lib/actor"
import { PAGE_KEYS, type PageKey } from "@/templates/registry"

import {
  dashboardSummary,
  ENQUIRY_RANGES,
  enquiryStats,
  readArticle,
  readPage,
  readService,
  searchContent,
  seoHealth,
  type ToolResult,
} from "./tool-data"

/** What the model reads when a tool fails, whatever the cause. */
export const TOOL_FAILED =
  "Couldn't read that site data just now. Try again in a moment."

/** A masked tool failure: its message is the only thing the model sees. */
export class ToolFailure extends Error {
  constructor() {
    super(TOOL_FAILED)
    this.name = "ToolFailure"
  }
}

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error

/**
 * Runs a tool as the actor. The permission is checked again on every call
 * (not only when the tool is offered). Any failure is logged by tool and
 * error name only (never its message, the input or the chat text) and
 * reaches the model as TOOL_FAILED.
 */
function guard<I>(
  actor: Actor,
  name: string,
  allowed: () => boolean,
  run: (input: I) => Promise<ToolResult>
): (input: I) => Promise<ToolResult> {
  return async (input) => {
    try {
      if (!allowed()) throw new Error("not allowed")
      return await run(input)
    } catch (error) {
      console.error(`[ai] tool ${name} failed: ${errorName(error)}`)
      throw new ToolFailure()
    }
  }
}

const idOrSlug = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .describe(
    "The record's id, or its slug (as in /services/<slug> or /blog/<slug>)"
  )

/**
 * The read-only tools this actor may use (spec §6.3). A tool is offered only
 * when the actor's roles grant its permission, and re-checks it when run.
 * No tool writes, and none reads settings, integrations, users or sessions.
 */
export function buildTools(input: { actor: Actor; config: AiConfig }): ToolSet {
  const { actor, config } = input
  const can = (req: PermissionRequest) => hasPermission(actor.roles, req)
  const canContent = () =>
    can({ page: ["read"] }) ||
    can({ service: ["read"] }) ||
    can({ article: ["read"] })
  const tools: ToolSet = {}

  if (canContent())
    tools.searchContent = tool({
      description:
        "Find website pages, services and articles (drafts included) by words in their title or address. Returns kind, id, title, path and status.",
      inputSchema: z.object({ query: searchQuery.shape.q }),
      execute: guard(actor, "searchContent", canContent, ({ query }) =>
        searchContent(actor, query)
      ),
    })

  if (can({ page: ["read"] }))
    tools.getPage = tool({
      description:
        "Read one fixed website page: its draft copy as text, its status and its SEO fields.",
      inputSchema: z.object({
        key: z.enum(PAGE_KEYS as [PageKey, ...PageKey[]]),
      }),
      execute: guard(
        actor,
        "getPage",
        () => can({ page: ["read"] }),
        ({ key }) => readPage(actor, key)
      ),
    })

  if (can({ service: ["read"] }))
    tools.getService = tool({
      description:
        "Read one service: its draft copy as text, its status and its SEO fields.",
      inputSchema: z.object({ idOrSlug }),
      execute: guard(
        actor,
        "getService",
        () => can({ service: ["read"] }),
        ({ idOrSlug }) => readService(actor, idOrSlug)
      ),
    })

  if (can({ article: ["read"] }))
    tools.getArticle = tool({
      description:
        "Read one article (insight): its draft text (up to 8000 characters), status, category, byline and SEO fields.",
      inputSchema: z.object({ idOrSlug }),
      execute: guard(
        actor,
        "getArticle",
        () => can({ article: ["read"] }),
        ({ idOrSlug }) => readArticle(actor, idOrSlug)
      ),
    })

  if (can({ seo: ["read"] }))
    tools.getSeoHealth = tool({
      description:
        "The SEO health of the published pages: a score from 0 to 100 and the open issues with the page they are on.",
      inputSchema: z.object({}),
      execute: guard(
        actor,
        "getSeoHealth",
        () => can({ seo: ["read"] }),
        () => seoHealth(actor)
      ),
    })

  tools.getDashboardSummary = tool({
    description:
      "The admin dashboard as this user sees it: key numbers and the next-up checklist.",
    inputSchema: z.object({}),
    execute: guard(
      actor,
      "getDashboardSummary",
      () => true,
      () => dashboardSummary(actor)
    ),
  })

  if (can({ lead: ["read"] }))
    tools.getEnquiryStats = tool({
      description: config.shareEnquiryDetails.enabled
        ? "Enquiry (lead) numbers for the last 7, 30 or 90 days by status, service and week, plus the most recent enquiries without contact details."
        : "Enquiry (lead) numbers for the last 7, 30 or 90 days by status, service and week. No names or messages.",
      inputSchema: z.object({
        range: z.enum(
          Object.keys(ENQUIRY_RANGES) as [keyof typeof ENQUIRY_RANGES]
        ),
      }),
      execute: guard(
        actor,
        "getEnquiryStats",
        () => can({ lead: ["read"] }),
        ({ range }) => enquiryStats(actor, config, range)
      ),
    })

  return tools
}
