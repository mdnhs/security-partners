import { describe, expect, it } from "vitest"

import { type QaFinding, scanContent } from "@/lib/content/qa"

type Input = Parameters<typeof scanContent>[0]

const legalOk: Input["pages"] = [
  {
    key: "privacy",
    data: { body: "Ours." },
    published: true,
    updatedSinceSeed: true,
  },
  {
    key: "terms",
    data: { body: "Ours." },
    published: true,
    updatedSinceSeed: true,
  },
]

const clean: Input = {
  settings: {
    contact: { phone: "+353 1 234 5678", email: "info@securitypartners.ie" },
    footer: { tagline: "Protecting Ireland since 1998" },
  },
  pages: legalOk,
  services: [{ id: "s1", title: "Guarding", data: { title: "Guarding" } }],
}

const rules = (findings: QaFinding[]) => findings.map((f) => f.rule)

describe("scanContent (content QA)", () => {
  it("finds nothing in finished content", () => {
    expect(scanContent(clean)).toEqual([])
  })

  it("QA flags [phone] in contact and unpublished terms", () => {
    const findings = scanContent({
      ...clean,
      settings: { ...clean.settings, contact: { phone: "[phone]" } },
      pages: [
        legalOk[0]!,
        { key: "terms", data: {}, published: false, updatedSinceSeed: true },
      ],
    })
    expect(findings).toEqual([
      expect.objectContaining({
        rule: "placeholder-contact",
        label: "Contact details",
        href: "/admin/settings/contact",
      }),
      expect.objectContaining({
        rule: "legal-unpublished",
        label: "Terms of use",
        href: "/admin/pages/terms",
      }),
    ])
    // [phone] is reported once, as a contact placeholder (not also as copy).
    expect(rules(findings)).not.toContain("placeholder-copy")
  })

  it("placeholder-contact: [email], example.com/.ie and runs of zeros in contact and footer", () => {
    for (const value of [
      "[email]",
      "[Phone]",
      "hello@example.com",
      "www.example.ie",
      "01 000 0000",
    ]) {
      expect(
        rules(scanContent({ ...clean, settings: { footer: { line: value } } }))
      ).toEqual(["placeholder-contact"])
    }
    // Media ids and other keys are not contact details.
    expect(
      scanContent({
        ...clean,
        settings: {
          contact: { icon: "00000000-0000-7000-8000-000000000001" },
          "sections.contact": { phonePlaceholder: "085 000 0000" },
        },
      })
    ).toEqual([])
  })

  it("placeholder-copy: lorem ipsum, TODO, TBC and [bracketed] text anywhere", () => {
    const findings = scanContent({
      settings: { site: { name: "Lorem ipsum dolor" } },
      pages: [
        ...legalOk,
        {
          key: "home",
          data: { hero: { lines: [{ text: "Call us TODO" }] } },
          published: true,
          updatedSinceSeed: false,
        },
      ],
      services: [
        { id: "s1", title: "Guarding", data: { body: "Price [insert price]" } },
        { id: "s2", title: "Patrols", data: { body: "Launch TBC" } },
      ],
    })
    expect(findings.map((f) => [f.rule, f.label, f.href])).toEqual([
      ["placeholder-copy", "Identity", "/admin/settings/site"],
      ["placeholder-copy", "Home", "/admin/pages/home"],
      ["placeholder-copy", "Guarding", "/admin/services/s1"],
      ["placeholder-copy", "Patrols", "/admin/services/s2"],
    ])
    expect(findings[2]!.message).toContain("[insert price]")
  })

  it("no false positives on ordinary words and long brackets", () => {
    expect(
      scanContent({
        ...clean,
        services: [
          {
            id: "s1",
            title: "Guarding",
            data: {
              body: "Todos los días; tbcs; {phone}; " + `[${"x".repeat(41)}]`,
            },
          },
        ],
      })
    ).toEqual([])
  })

  it("one finding per record and rule, with a count of further matches", () => {
    const findings = scanContent({
      ...clean,
      services: [
        { id: "s1", title: "Guarding", data: ["TODO one", "TODO two", "TBC"] },
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.message).toMatch(/and 2 more/)
  })

  it("legal-unpublished: privacy or terms missing, unpublished or never edited since the seed", () => {
    const findings = scanContent({
      ...clean,
      pages: [
        { key: "privacy", data: {}, published: true, updatedSinceSeed: false },
      ],
    })
    expect(findings.map((f) => [f.rule, f.href])).toEqual([
      ["legal-unpublished", "/admin/pages/privacy"],
      ["legal-unpublished", "/admin/pages/terms"],
    ])
    expect(findings[0]!.message).toMatch(/starter text/i)
    expect(findings[1]!.message).toMatch(/missing/i)
  })

  it("scans builder pages (/p/<slug>) and links to their editor", () => {
    const findings = scanContent({
      ...clean,
      builderPages: [
        {
          id: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
          title: "Spring offer",
          data: {
            blocks: [
              {
                id: "0190a1b2-c3d4-7e5f-8a9b-000000000001",
                data: { heading: "Lorem ipsum dolor" },
              },
            ],
          },
        },
        { id: "b2", title: "Clean page", data: { blocks: [] } },
      ],
    })
    expect(findings).toEqual([
      expect.objectContaining({
        rule: "placeholder-copy",
        label: "Spring offer",
        href: "/admin/pages/custom/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
      }),
    ])
  })

  it("skips the legal rule when no pages are passed (the viewer can't read pages)", () => {
    expect(scanContent({ ...clean, pages: [] })).toEqual([])
  })

  it("treats a hostile value as plain text and clips it in the message", () => {
    const [finding] = scanContent({
      ...clean,
      services: [
        {
          id: "s1",
          title: "Guarding",
          data: { body: `<script>alert(1)</script> TODO ${"y".repeat(500)}` },
        },
      ],
    })
    expect(finding!.message.length).toBeLessThanOrEqual(160)
  })
})
