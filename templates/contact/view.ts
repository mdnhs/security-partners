import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { DepartmentsProps } from "@/components/contact/departments"
import type { PageHeroProps } from "@/components/home/page-hero"
import { interpolate, interpolateHref } from "@/lib/interpolate"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  contactSectionView,
  locationMapView,
  pageHeroView,
  placeholders,
} from "@/templates/shared/views"

export type ContactView = {
  chrome: ChromeView
  hero: PageHeroProps
  contact: ContactProps
  departments: DepartmentsProps
  map: LocationMapProps
}

export function contactView(s: SiteSources): ContactView {
  const page = s.pages.contact.data
  const values = placeholders(s)
  return {
    chrome: chromeView(s),
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
