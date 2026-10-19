import type { ActivityEntry } from "@/components/admin/kit/activity-feed"
import type { GaugePart } from "@/components/admin/kit/gauge-math"
import type { KpiCardProps } from "@/components/admin/kit/kpi-card"
import type { PillBarDatum } from "@/components/admin/kit/pill-bar-chart"
import type { StatusTone } from "@/components/admin/kit/status-pill"
import type { NextUpItem } from "@/lib/schemas/api/dashboard"

// Fixed sample data for /admin/design (MK-parity A7): client demos, the
// side-by-side review against the MK reference and the visual baselines.
// Nothing here is read from or written to the database.

/** "Now" for the relative times in Team activity: shots never drift. */
export const SAMPLE_NOW = Date.parse("2026-10-16T10:00:00Z")

export const SAMPLE_KPIS: KpiCardProps[] = [
  {
    label: "New enquiries",
    value: "24",
    delta: { label: "+3.4%", direction: "up" },
    caption: "vs last month",
    href: "/admin/leads",
    variant: "hero",
  },
  {
    label: "Open enquiries",
    value: "7",
    delta: { label: "-1.2%", direction: "down" },
    caption: "vs last month",
    href: "/admin/leads",
  },
  {
    label: "Published content",
    value: "22",
    delta: { label: "+2.1%", direction: "up" },
    caption: "8 pages · 6 services · 8 articles",
    href: "/admin/pages",
  },
  {
    label: "Drafts in review",
    value: "2",
    delta: null,
    caption: "articles waiting for an editor",
    href: "/admin/insights?status=in_review",
  },
]

export const SAMPLE_WEEK: PillBarDatum[] = [
  { key: "mon", label: "Mon", current: 4, previous: 3 },
  { key: "tue", label: "Tue", current: 6, previous: 5 },
  { key: "wed", label: "Wed", current: 5, previous: 7 },
  { key: "thu", label: "Thu", current: 9, previous: 6 },
  { key: "fri", label: "Fri", current: 3, previous: 8 },
  { key: "sat", label: "Sat", current: 1, previous: 2 },
  { key: "sun", label: "Sun", current: 2, previous: 3 },
]

export const SAMPLE_NEXT_UP: NextUpItem[] = [
  {
    id: "smtp",
    title: "Set up email (SMTP)",
    description: "So enquiries and invitations reach people.",
    href: "/admin/settings/integrations/smtp",
    done: false,
  },
  {
    id: "two-factor",
    title: "Turn on two-factor authentication",
    description: "Protect the owner and admin accounts.",
    href: "/admin/account?tab=security",
    done: true,
  },
  {
    id: "review",
    title: "Review two articles",
    description: "Drafts are waiting for an editor.",
    href: "/admin/insights?status=in_review",
    done: false,
  },
]

export const SAMPLE_TEAM: ActivityEntry[] = [
  {
    id: "a1",
    name: "Niamh Walsh",
    description: "Published “Night Patrols Explained”",
    at: "2026-10-16T09:20:00Z",
    status: { label: "Published", tone: "success" },
  },
  {
    id: "a2",
    name: "Ciarán Doyle",
    description: "Editing the About page",
    at: "2026-10-16T08:05:00Z",
    status: { label: "Unpublished changes", tone: "warning" },
  },
  {
    id: "a3",
    name: "Aoife Byrne",
    description: "New enquiry from the contact form",
    at: "2026-10-15T16:40:00Z",
    status: { label: "New", tone: "info" },
  },
  {
    id: "a4",
    name: "Seán Murphy",
    description: "Test email to smtp.example.ie",
    at: "2026-10-14T11:00:00Z",
    status: { label: "Failed", tone: "danger" },
  },
]

export const SAMPLE_CONTENT_HEALTH: GaugePart[] = [
  { key: "passed", label: "Passing", value: 41, tone: "solid" },
  { key: "work", label: "Needs work", value: 30, tone: "dark" },
  {
    key: "missing",
    label: "Missing SEO or alt text",
    value: 29,
    tone: "hatched",
  },
]

/** One pill per tone, labelled with a status that maps to it. */
export const SAMPLE_STATUSES: { label: string; tone: StatusTone }[] = [
  { label: "Published", tone: "success" },
  { label: "Unpublished changes", tone: "warning" },
  { label: "Failed", tone: "danger" },
  { label: "Scheduled", tone: "info" },
  { label: "Draft", tone: "neutral" },
]

export const SAMPLE_REGIONS = [
  { value: "dublin", label: "Dublin" },
  { value: "cork", label: "Cork" },
  { value: "galway", label: "Galway" },
  { value: "limerick", label: "Limerick" },
]

export const SAMPLE_RESPONSE_TIMES = [
  { value: "30", label: "Within 30 minutes" },
  { value: "60", label: "Within an hour" },
  { value: "next-day", label: "Next working day" },
]

export const SAMPLE_LEADS: {
  id: string
  name: string
  service: string
  received: string
  status: { label: string; tone: StatusTone }
}[] = [
  {
    id: "l1",
    name: "Aoife Byrne",
    service: "Alarm Responses",
    received: "16 Oct 2026",
    status: { label: "New", tone: "info" },
  },
  {
    id: "l2",
    name: "Liam O’Connor",
    service: "Mobile Patrols",
    received: "15 Oct 2026",
    status: { label: "Contacted", tone: "warning" },
  },
  {
    id: "l3",
    name: "Grace Kelly",
    service: "Key Holding",
    received: "12 Oct 2026",
    status: { label: "Won", tone: "success" },
  },
  {
    id: "l4",
    name: "Darragh Ryan",
    service: "Static Guarding",
    received: "9 Oct 2026",
    status: { label: "Lost", tone: "danger" },
  },
]

export const SAMPLE_ITEMS: {
  id: string
  title: string
  description: string
  status: { label: string; tone: StatusTone }
}[] = [
  {
    id: "i1",
    title: "Alarm Responses",
    description: "Keyholders on call around the clock.",
    status: { label: "Published", tone: "success" },
  },
  {
    id: "i2",
    title: "Mobile Patrols",
    description: "Marked vehicles, randomised routes.",
    status: { label: "Unpublished changes", tone: "warning" },
  },
  {
    id: "i3",
    title: "Event Security",
    description: "Licensed staff for venues and festivals.",
    status: { label: "Draft", tone: "neutral" },
  },
]
