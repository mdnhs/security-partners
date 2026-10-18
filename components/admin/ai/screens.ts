import type { LeadDto } from "@/lib/schemas/api/leads"

import type { AssistantScreen } from "./assistant-context"

/**
 * A lead as the assistant sees it ("summarise a lead", spec §8.3): what was
 * asked and the staff notes. Email and phone stay out — the provider does
 * not need them to summarise (data minimisation). The title names no one,
 * because conversations store it.
 */
export function leadAssistantScreen(lead: LeadDto): AssistantScreen {
  return {
    title: "Lead details",
    entityType: "lead",
    entityId: lead.id,
    record: {
      name: lead.name,
      company: lead.company,
      service: lead.service,
      message: lead.message,
      status: lead.status,
      sourcePage: lead.sourcePage,
      receivedAt: lead.createdAt,
      notes: lead.events
        .filter((event) => event.type === "note" && event.body)
        .map((event) => ({
          at: event.createdAt,
          by: event.actor?.name ?? null,
          text: event.body,
        })),
    },
  }
}
