import { describe, expect, it, vi } from "vitest"

import type {
  AssistantField,
  AssistantScreen,
} from "@/components/admin/ai/assistant-context"
import {
  chatContextFrom,
  starterPrompts,
} from "@/components/admin/ai/chat-context"
import { leadAssistantScreen } from "@/components/admin/ai/screens"
import type { LeadDto } from "@/lib/schemas/api/leads"
import { AI_MAX_RECORD_CHARS } from "@/lib/schemas/api/ai"

const screen: AssistantScreen = {
  title: "Home page",
  entityType: "page",
  entityId: "home",
  record: { hero: { heading: "Old heading" } },
}

const field: AssistantField = {
  path: "hero.heading",
  label: "Heading",
  maxLength: 80,
  elementId: "sf-hero-heading",
  read: () => "Typed just now",
  apply: vi.fn(),
}

describe("chatContextFrom", () => {
  it("sends the screen, the record and the field's current value", () => {
    expect(chatContextFrom(screen, field)).toEqual({
      screen: "Home page",
      entityType: "page",
      entityId: "home",
      field: {
        path: "hero.heading",
        label: "Heading",
        value: "Typed just now",
        maxLength: 80,
      },
      record: { hero: { heading: "Old heading" } },
    })
  })

  it("sends nothing without a screen; leaves out a record that is too large", () => {
    expect(chatContextFrom(null, field)).toBeUndefined()
    const big = chatContextFrom(
      { ...screen, record: { body: "x".repeat(AI_MAX_RECORD_CHARS) } },
      null
    )
    expect(big).toEqual({
      screen: "Home page",
      entityType: "page",
      entityId: "home",
    })
    expect(
      chatContextFrom({ title: "x".repeat(200) }, null)?.screen
    ).toHaveLength(120)
  })
})

describe("starterPrompts", () => {
  it("offers field, lead and page prompts", () => {
    expect(
      starterPrompts({ title: "Home page", entityType: "page" }, "Heading")
    ).toEqual([
      "Rewrite “Heading” to be clearer and shorter.",
      "Suggest three alternatives for “Heading”.",
      "Suggest an SEO title and description for “Home page”.",
    ])
    expect(
      starterPrompts({ title: "Lead details", entityType: "lead" }, null)
    ).toEqual(["Summarise this lead and suggest a next step."])
    expect(starterPrompts(null, null)).toEqual([
      "Draft a short introduction to our security services.",
      "Suggest an SEO title and description for the home page.",
    ])
  })
})

describe("leadAssistantScreen (summarise a lead, spec §8.3)", () => {
  const lead = {
    id: "0190a6e0-0000-7000-8000-000000000001",
    name: "Jane Murphy",
    email: "jane@example.ie",
    phone: "+353 1 555 0100",
    company: "Murphy Retail",
    status: "new",
    assignee: null,
    sourcePage: "/contact",
    createdAt: "2026-10-16T09:00:00.000Z",
    service: "Static guarding",
    message: "We need guards for two shops from November.",
    consent: true,
    updatedAt: "2026-10-16T09:05:00.000Z",
    events: [
      {
        id: "e1",
        type: "created",
        body: null,
        actor: null,
        createdAt: "2026-10-16T09:00:00.000Z",
      },
      {
        id: "e2",
        type: "note",
        body: "Called back, wants a quote",
        actor: { id: "u1", name: "Ivy Intake" },
        createdAt: "2026-10-16T09:05:00.000Z",
      },
    ],
  } as LeadDto

  it("shares what was asked and the notes, not the contact details", () => {
    const shared = leadAssistantScreen(lead)
    expect(shared).toMatchObject({
      title: "Lead details",
      entityType: "lead",
      entityId: lead.id,
    })
    expect(shared.record).toEqual({
      name: "Jane Murphy",
      company: "Murphy Retail",
      service: "Static guarding",
      message: "We need guards for two shops from November.",
      status: "new",
      sourcePage: "/contact",
      receivedAt: "2026-10-16T09:00:00.000Z",
      notes: [
        {
          at: "2026-10-16T09:05:00.000Z",
          by: "Ivy Intake",
          text: "Called back, wants a quote",
        },
      ],
    })
    const json = JSON.stringify(shared)
    expect(json).not.toContain("jane@example.ie")
    expect(json).not.toContain("555 0100")
  })
})
