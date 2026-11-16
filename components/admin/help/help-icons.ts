import {
  BookOpen,
  CircleHelp,
  Globe,
  Inbox,
  type LucideIcon,
  Newspaper,
  SearchCheck,
  Settings,
  Users,
} from "lucide-react"

import type { HelpGroupId } from "@/lib/admin/help/registry"

/** One icon per docs group, matching the sidebar's icon for that area. */
export const HELP_GROUP_ICONS: Record<HelpGroupId, LucideIcon> = {
  start: BookOpen,
  website: Globe,
  content: Newspaper,
  inbox: Inbox,
  growth: SearchCheck,
  settings: Settings,
  team: Users,
  faq: CircleHelp,
}
