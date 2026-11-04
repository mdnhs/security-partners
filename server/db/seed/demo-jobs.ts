import "server-only"

import { dublinToday } from "@/lib/careers/open"
import { type JobContent, jobContent } from "@/lib/schemas/content/job"
import type { Db } from "@/server/db/client"
import { jobOpenings } from "@/server/db/schema"

// Demo openings from the Figma careers designs (548:18): five open roles and
// three previous openings, dated relative to `now` so the open ones stay
// open. For dev and the e2e/visual database only — never part of
// `pnpm db:seed` or the first-deploy seed: fictional job adverts must not
// appear on a live site.

const DAY = 86_400_000
const dateIn = (now: Date, days: number) => {
  const [y, m, d] = dublinToday(now).split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const paragraph = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
})

type Demo = {
  slug: string
  postedDaysAgo: number
  closesInDays: number
  content: Omit<JobContent, "closingDate">
}

const common = {
  essential: [
    "Valid PSA Security Guard (Static) licence",
    "Verifiable 5-year employment / education history",
    "Minimum 1 year static security experience in Ireland",
    "Right to work full-time in Ireland",
    "Good written and spoken English for reports",
  ],
  desirable: [
    "First Aid Responder (FAR) or Occupational First Aid",
    "Fire Warden or Manual Handling certificate",
    "Full clean driving licence and own transport (site is outside town)",
  ],
  offers: [
    { icon: "euro" as const, text: "Night shift premium" },
    { icon: "shield" as const, text: "Paid PSA licence renewal" },
    { icon: "shirt" as const, text: "Uniform, boots & PPE provided" },
    { icon: "clock" as const, text: "Paid overtime available" },
    { icon: "wallet" as const, text: "Company pension scheme" },
    { icon: "heart" as const, text: "Employee Assistance Programme" },
  ],
  urgent: false,
  filled: false,
}

const DEMOS: Demo[] = [
  {
    slug: "static-security-officer",
    postedDaysAgo: 2,
    closesInDays: 25,
    content: {
      ...common,
      title: "Static Security Officer",
      category: "Static Guarding",
      licence: "Security Guard (Static)",
      location: "Portlaoise, Co. Laois",
      employmentType: "Full-time, Permanent",
      contractType: "full-time",
      shift: "4-on-4-off, 12hr shifts",
      pay: "€15.50–€16.50/hr",
      reference: "SP-2611-STA",
      startDate: "December 2026",
      summary:
        "Full-time, permanent role on a long-term logistics site contract in Portlaoise.",
      about: {
        type: "doc",
        content: [
          paragraph(
            "Security Partners is recruiting an experienced Static Security Officer for a long-term contract at a large logistics and distribution site in Portlaoise. You'll be the first point of contact for staff, drivers and visitors — protecting people, property and assets around the clock."
          ),
          paragraph(
            "This is a full-time, permanent position on a 4-on-4-off rotating roster of 12-hour day and night shifts (average 42 hours per week), with paid PSA licence renewal and ongoing training through our in-house programme."
          ),
        ],
      },
      responsibilities: [
        "Control access at the gatehouse — check IDs, issue visitor passes and log all vehicle movements",
        "Carry out regular foot patrols, checking doors, perimeter fencing, alarm panels and fire points",
        "Monitor CCTV and respond to alarm activations in line with site instructions",
        "Write clear incident reports and keep the daily occurrence book (DOB) up to date",
        "Respond to emergencies and liaise with Gardaí, fire services and our 24hr control room",
        "Deliver a professional, courteous service to everyone on site",
      ],
      offerIntro:
        "Competitive pay of €15.50–€16.50 per hour depending on experience, plus:",
    },
  },
  {
    slug: "mobile-patrol-alarm-response-officer",
    postedDaysAgo: 5,
    closesInDays: 20,
    content: {
      ...common,
      urgent: true,
      title: "Mobile Patrol & Alarm Response Officer",
      category: "Mobile Patrol",
      licence: "Security Guard (Static)",
      location: "Laois & Offaly",
      employmentType: "Full-time",
      contractType: "full-time",
      shift: "Nights, 4-on-4-off",
      pay: "€16.50/hr + company vehicle",
      reference: "SP-2611-MOB",
      startDate: "December 2026",
      summary:
        "Night patrols and alarm response across Laois and Offaly in a liveried company vehicle.",
      about: {
        type: "doc",
        content: [
          paragraph(
            "Patrol client sites and respond to alarm activations across Laois and Offaly."
          ),
        ],
      },
      responsibilities: [
        "Patrol client sites on a planned route",
        "Respond to alarm activations within agreed times",
        "Hold and manage client keys securely",
      ],
      offerIntro: "€16.50 per hour, a company vehicle and fuel card, plus:",
    },
  },
  {
    slug: "cctv-monitoring-operator",
    postedDaysAgo: 7,
    closesInDays: 30,
    content: {
      ...common,
      title: "CCTV Monitoring Operator",
      category: "Monitoring",
      licence: "Monitoring Centre Operative",
      location: "Mountmellick, Co. Laois",
      employmentType: "Full-time",
      contractType: "full-time",
      shift: "Days & nights rota, 12hr shifts",
      pay: "€15.75/hr",
      reference: "SP-2611-CCTV",
      startDate: "January 2027",
      summary:
        "Monitor remote CCTV and alarms from our 24hr monitoring centre in Mountmellick.",
      about: {
        type: "doc",
        content: [
          paragraph("Join the operators in our 24hr monitoring centre."),
        ],
      },
      responsibilities: [
        "Monitor remote CCTV and alarm systems",
        "Dispatch mobile units and contact keyholders",
        "Log every event accurately",
      ],
      offerIntro: "€15.75 per hour, plus:",
    },
  },
  {
    slug: "event-security-steward",
    postedDaysAgo: 8,
    closesInDays: 40,
    content: {
      ...common,
      title: "Event Security Steward",
      category: "Events",
      licence: "Security Guard (Event)",
      location: "Midlands (various venues)",
      employmentType: "Casual / Part-time",
      contractType: "part-time",
      shift: "Weekends & evenings",
      pay: "€16.00–€17.00/hr",
      reference: "SP-2611-EVT",
      startDate: "Ongoing",
      summary:
        "Crowd and access control at concerts, matches and festivals across the Midlands.",
      about: {
        type: "doc",
        content: [
          paragraph("Steward events of every size across the Midlands."),
        ],
      },
      responsibilities: [
        "Control access and check tickets",
        "Manage crowds safely",
        "Assist with first aid and emergencies",
      ],
      offerIntro: "€16.00–€17.00 per hour, plus:",
    },
  },
  {
    slug: "intruder-alarm-cctv-installer",
    postedDaysAgo: 14,
    closesInDays: 35,
    content: {
      ...common,
      title: "Intruder Alarm & CCTV Installer",
      category: "Installations",
      licence: "Installer (Intruder Alarm / CCTV)",
      location: "Co. Laois (field-based)",
      employmentType: "Full-time",
      contractType: "full-time",
      shift: "Mon–Fri, 39 hrs/week",
      pay: "€34,000–€40,000 + van",
      reference: "SP-2611-INS",
      startDate: "January 2027",
      summary:
        "Install and service intruder alarms and CCTV for homes and businesses.",
      about: {
        type: "doc",
        content: [paragraph("Install and maintain alarm and CCTV systems.")],
      },
      responsibilities: [
        "Install intruder alarms and CCTV",
        "Carry out maintenance visits",
        "Commission and hand over systems",
      ],
      offerIntro: "A salary of €34,000–€40,000 and a company van, plus:",
    },
  },
  {
    slug: "retail-security-officer",
    postedDaysAgo: 80,
    closesInDays: -51,
    content: {
      ...common,
      title: "Retail Security Officer",
      category: "Static Guarding",
      licence: "Security Guard (Static)",
      location: "Tullamore, Co. Offaly",
      employmentType: "Part-time",
      contractType: "part-time",
      shift: "Thu–Sun, 8hr shifts",
      pay: "€15.50/hr",
      reference: "SP-2609-RET",
      startDate: "October 2026",
      summary: "Retail store detective role in Tullamore.",
      about: { type: "doc", content: [paragraph("A filled retail role.")] },
      responsibilities: ["Deter theft", "Assist staff"],
      offerIntro: "",
      filled: true,
    },
  },
  {
    slug: "site-security-officer-construction",
    postedDaysAgo: 90,
    closesInDays: -69,
    content: {
      ...common,
      title: "Site Security Officer – Construction",
      category: "Static Guarding",
      licence: "Security Guard (Static)",
      location: "Naas, Co. Kildare",
      employmentType: "Full-time",
      contractType: "full-time",
      shift: "Nights, 12hr shifts",
      pay: "€16.00/hr",
      reference: "SP-2609-CON",
      startDate: "September 2026",
      summary: "Night security on a construction site in Naas.",
      about: {
        type: "doc",
        content: [paragraph("A filled construction site role.")],
      },
      responsibilities: ["Patrol the site", "Log deliveries"],
      offerIntro: "",
      filled: true,
    },
  },
  {
    slug: "keyholding-response-supervisor",
    postedDaysAgo: 110,
    closesInDays: -87,
    content: {
      ...common,
      title: "Keyholding & Response Supervisor",
      category: "Mobile Patrol",
      licence: "Security Guard (Static)",
      location: "Portarlington, Co. Laois",
      employmentType: "Full-time",
      contractType: "full-time",
      shift: "Rotating shifts",
      pay: "€36,000/yr",
      reference: "SP-2608-KEY",
      startDate: "September 2026",
      summary: "Supervise the keyholding and response team.",
      about: { type: "doc", content: [paragraph("A filled supervisor role.")] },
      responsibilities: ["Lead the response team", "Manage keyholding records"],
      offerIntro: "",
      filled: true,
    },
  },
]

/** Inserts the demo openings that are missing (by address); returns how many. */
export async function seedDemoJobs(
  db: Db,
  now: Date = new Date()
): Promise<number> {
  const rows = DEMOS.map((demo) => {
    const content = jobContent.parse({
      ...demo.content,
      closingDate: dateIn(now, demo.closesInDays),
    })
    return {
      slug: demo.slug,
      draft: content,
      published: content,
      status: "published" as const,
      publishedAt: new Date(now.getTime() - demo.postedDaysAgo * DAY),
    }
  })
  const inserted = await db
    .insert(jobOpenings)
    .values(rows)
    .onConflictDoNothing({ target: jobOpenings.slug })
    .returning({ id: jobOpenings.id })
  return inserted.length
}
