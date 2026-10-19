import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import { isUuid } from "@/lib/ids"
import type { ChatContext } from "@/lib/schemas/api/ai"
import type { AiConfig } from "@/lib/schemas/integrations"
import type { Actor } from "@/server/lib/actor"
import { AppError } from "@/server/lib/errors"
import { getLead } from "@/server/modules/leads/service"

import { oneLine } from "./prompt"
import { redactContacts } from "./redact"
import { knownServices, serviceBucket } from "./tool-data"

/**
 * Screens whose record is website copy (the versioned editors), passed to
 * the model as the browser sends it. Settings editors share their record
 * too (site name, contact details shown on the site).
 */
const SITE_COPY = new Set(["page", "service", "article", "settings"])

/** Longest enquiry message or note put into the screen context. */
const LEAD_TEXT_MAX = 2000

const clip = (text: string, max: number) => {
  const chars = [...text]
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text
}

export type ScreenContext = {
  context: ChatContext | undefined
  /** Enquiry details (name, company, message, notes) went to the model. */
  enquiryDetails: boolean
}

/**
 * The screen context the model may see. A lead screen's record is never
 * taken from the browser: it is read again here as the user, and
 * - email and phone never go to the provider;
 * - with the owner's enquiry-details switch off, only non-personal facts
 *   do (status, the service as a known service name, the date received),
 *   and the focused field (a note being written) is left out;
 * - with it on, name, company, message and notes go too, with contact
 *   details typed into them removed (best effort).
 * Site-copy screens (SITE_COPY) pass unchanged; any other screen sends no
 * record.
 */
export async function screenContextFor(
  actor: Actor,
  config: AiConfig,
  context: ChatContext | undefined
): Promise<ScreenContext> {
  if (!context) return { context, enquiryDetails: false }
  if (context.entityType !== "lead") {
    // Site copy only: any other entity type (or none) sends no record
    // (C9 review M6). The field the user focused stays: it is their text.
    if (context.entityType && SITE_COPY.has(context.entityType))
      return { context, enquiryDetails: false }
    const rest: ChatContext = { ...context }
    delete rest.record
    return { context: rest, enquiryDetails: false }
  }
  const share = config.shareEnquiryDetails.enabled
  const leadId =
    context.entityId && isUuid(context.entityId as unknown)
      ? context.entityId
      : undefined
  const safe: ChatContext = {
    screen: context.screen,
    entityType: "lead",
    entityId: leadId,
  }
  if (share && context.field)
    safe.field = {
      ...context.field,
      value: redactContacts(context.field.value),
    }
  const fieldOnly = { context: safe, enquiryDetails: safe.field !== undefined }
  if (!leadId || !hasPermission(actor.roles, { lead: ["read"] }))
    return fieldOnly

  let lead
  try {
    lead = await getLead(actor, leadId)
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND")
      return fieldOnly
    throw error
  }
  const known = await knownServices()
  const facts = {
    status: lead.status,
    service: serviceBucket(lead.service, known),
    receivedAt: lead.createdAt,
    assigned: lead.assignee !== null,
  }
  if (!share)
    return { context: { ...safe, record: facts }, enquiryDetails: false }
  safe.record = {
    ...facts,
    name: redactContacts(oneLine(lead.name)),
    company: lead.company ? redactContacts(oneLine(lead.company)) : null,
    message: redactContacts(clip(lead.message.trim(), LEAD_TEXT_MAX)),
    notes: lead.events
      .filter((event) => event.type === "note" && event.body)
      .map((event) => ({
        at: event.createdAt,
        text: redactContacts(clip(event.body!.trim(), LEAD_TEXT_MAX)),
      })),
  }
  return { context: safe, enquiryDetails: true }
}
