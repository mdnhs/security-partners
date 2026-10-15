import type { ClientsProps } from "@/components/home/clients-team-blog"
import type { PageHeroProps } from "@/components/home/page-hero"
import type {
  EnquireBannerProps,
  ServicesProps,
} from "@/components/home/services"
import type { OtherServicesProps } from "@/components/services/other-services"
import type { ServiceBodyProps } from "@/components/services/service-body"
import type { WhyChooseUsProps } from "@/components/services/why-choose-us"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  clientsView,
  enquireBannerView,
  pageHeroView,
  placeholders,
  serviceCard,
  serviceCardLabels,
} from "@/templates/shared/views"

export type ServicesView = {
  chrome: ChromeView
  hero: PageHeroProps
  services: ServicesProps
  whyChooseUs: WhyChooseUsProps
  clients: ClientsProps
  enquireBanner: EnquireBannerProps
}

export function servicesView(s: SiteSources): ServicesView {
  const page = s.pages.services.data
  const why = s.settings["sections.whyChooseUs"]
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    services: {
      eyebrow: page.servicesSection.eyebrow,
      title: page.servicesSection.heading,
      description: page.servicesSection.intro,
      services: s.services.map(serviceCard),
      labels: serviceCardLabels(s),
    },
    whyChooseUs: {
      eyebrow: why.eyebrow,
      heading: why.heading,
      copy: why.copy,
      features: why.features.map((f) => ({
        title: f.title,
        description: f.description,
        icon: f.icon.url,
      })),
    },
    clients: clientsView(s),
    enquireBanner: enquireBannerView(s),
  }
}

export type ServiceDetailView = {
  chrome: ChromeView
  hero: PageHeroProps
  body: ServiceBodyProps
  others: OtherServicesProps
  enquireBanner: EnquireBannerProps
}

/** /services/[slug]; null for an unknown or unpublished slug (→ 404). */
export function serviceDetailView(
  s: SiteSources,
  slug: string
): ServiceDetailView | null {
  const index = s.services.findIndex((service) => service.slug === slug)
  if (index < 0) return null
  const service = s.services[index]
  const { content } = service
  const { microcopy } = s.settings
  const values = placeholders(s)
  // The next three services after this one, wrapping around the list.
  const others = [1, 2, 3]
    .map((offset) => s.services[(index + offset) % s.services.length])
    .filter((other) => other.slug !== slug)
  return {
    chrome: chromeView(s),
    hero: {
      image: content.heroImage.url,
      trail: [
        {
          label: microcopy.breadcrumb.services,
          href: microcopy.breadcrumb.servicesHref,
        },
      ],
      crumb: content.title,
      title: content.title,
      description: content.detail.intro,
      homeLabel: microcopy.breadcrumb.home,
      ariaLabel: microcopy.aria.breadcrumb,
    },
    body: {
      slug,
      image: { src: content.image.url, alt: content.imageAlt },
      heading: content.detail.heading,
      overview: content.detail.overview,
      included: content.detail.included,
      callout: content.detail.callout,
      phone24h: s.settings.contact.phone24h,
      phone24hHref: String(values.phone24hHref),
      allServices: s.services.map((x) => ({
        slug: x.slug,
        title: x.content.title,
      })),
      operations: {
        office: s.settings.contact.office,
        officeHref: String(values.officeHref),
        extension: s.settings.contact.operationsExtension,
        mobile: s.settings.contact.operationsMobile,
        mobileHref: String(values.operationsMobileHref),
        email: s.settings.contact.operationsEmail,
      },
      labels: {
        overviewEyebrow: microcopy.service.overviewEyebrow,
        includedHeading: microcopy.service.includedHeading,
        allServicesAria: microcopy.aria.allServices,
        allServicesHeading: microcopy.service.allServicesHeading,
        helpEyebrow: microcopy.service.helpEyebrow,
        helpHeading: microcopy.service.helpHeading,
        telLabel: microcopy.service.telLabel,
        orLabel: microcopy.service.orLabel,
        phone24hLabel: microcopy.service.phone24hLabel,
        cta: {
          label: microcopy.service.ctaLabel,
          href: microcopy.service.ctaHref,
        },
      },
    },
    others: {
      eyebrow: microcopy.service.otherEyebrow,
      heading: microcopy.service.otherHeading,
      intro: microcopy.service.otherIntro,
      services: others.map(serviceCard),
      labels: serviceCardLabels(s),
    },
    enquireBanner: enquireBannerView(s),
  }
}
