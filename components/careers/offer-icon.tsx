import {
  Car,
  Clock,
  Euro,
  GraduationCap,
  Heart,
  type LucideIcon,
  Moon,
  Phone,
  Shield,
  Shirt,
  Wallet,
} from "lucide-react"

import type { OfferIcon as OfferIconName } from "@/lib/schemas/content/job"

const ICONS: Record<OfferIconName, LucideIcon> = {
  euro: Euro,
  shield: Shield,
  shirt: Shirt,
  clock: Clock,
  wallet: Wallet,
  heart: Heart,
  graduation: GraduationCap,
  car: Car,
  phone: Phone,
  moon: Moon,
}

/** The icon of a "What We Offer" line (OFFER_ICONS). */
export function OfferIcon({
  name,
  className,
}: {
  name: OfferIconName
  className?: string
}) {
  const Icon = ICONS[name]
  return <Icon aria-hidden className={className} />
}
