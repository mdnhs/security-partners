import type { JobContent } from "@/lib/schemas/content/job"
import type { JobRecord } from "@/server/modules/jobs-board/queries"

/** A published job record for view tests; override any content field. */
export function jobRecord(
  slug: string,
  content: Partial<JobContent> = {},
  publishedAt = "2026-11-08T09:00:00Z"
): JobRecord {
  return {
    id: `00000000-0000-4000-8000-${String(slug.length).padStart(12, "0")}`,
    slug,
    publishedAt: new Date(publishedAt),
    content: {
      title: slug,
      category: "Static Guarding",
      licence: "Security Guard (Static)",
      location: "Portlaoise, Co. Laois",
      employmentType: "Full-time",
      contractType: "full-time",
      shift: "4-on-4-off, 12hr day/night shifts",
      pay: "€15.50–€16.50/hr",
      reference: "SP-2611-STA",
      startDate: "December 2026",
      closingDate: "2026-11-30",
      urgent: false,
      filled: false,
      summary: "A role.",
      about: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "About." }] },
        ],
      },
      responsibilities: ["Patrol"],
      essential: ["PSA licence"],
      desirable: [],
      offerIntro: "",
      offers: [],
      ...content,
    },
  }
}
