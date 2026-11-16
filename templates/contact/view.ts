import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { DepartmentsProps } from "@/components/contact/departments"
import type { PageHeroProps } from "@/components/home/page-hero"
import { interpolate, interpolateHref } from "@/lib/interpolate"
import { CONTACT_SECTIONS, visibleSections } from "@/templates/shared/sections"
import type { SiteSources } from "@/templates/shared/sources"
import {
  contactSectionView,
  locationMapView,
  pageHeroView,
  placeholders,
} from "@/templates/shared/views"

export type ContactView = {
  hero: PageHeroProps
  sections: (typeof CONTACT_SECTIONS)[number][]
  contact: ContactProps
  departments: DepartmentsProps
  map: LocationMapProps
}

export function contactView(s: SiteSources): ContactView {
  const page = s.pages.contact.data
  const values = placeholders(s)
  return {
    sections: visibleSections(page.sections, CONTACT_SECTIONS),
    hero: pageHeroView(s, page.hero, { wideDescription: true }),
    contact: contactSectionView(s),
    departments: {
      eyebrow: page.departments.eyebrow,
      heading: page.departments.heading,
      intro: page.departments.intro,
      items: page.departments.items.map((item) => ({
        title: item.title,
        icon: item.icon.url,
        name: item.name,
        role: item.role,
        lines: item.lines.map((line) => ({
          text: interpolate(line.text, values),
          href: interpolateHref(line.href, values),
        })),
      })),
    },
    map: locationMapView(s),
  }
}
