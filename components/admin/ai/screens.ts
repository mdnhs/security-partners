import type { LeadDto } from "@/lib/schemas/api/leads"

import type { AssistantScreen } from "./assistant-context"

/**
 * A lead as the assistant sees it ("summarise a lead", spec §8.3). Only
 * which lead: the server reads it again as the user and decides what the
 * model may see (the owner's enquiry-details switch), so no personal data
 * travels in the request (C9 review M5). The title names no one, because
 * conversations store it.
 */
export function leadAssistantScreen(lead: LeadDto): AssistantScreen {
  return {
    title: "Lead details",
    entityType: "lead",
    entityId: lead.id,
  }
}
