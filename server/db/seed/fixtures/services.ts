import "server-only"

import type { Seo } from "@/lib/schemas/common"
import type { ServiceContent } from "@/lib/schemas/content/service"

import type { MediaLookup } from "./media"
import { paragraphs } from "./rich-text"

export type ServiceFixture = { slug: string; content: ServiceContent; seo: Seo }

type ServiceCopy = {
  slug: string
  title: string
  description: string
  icon: Parameters<MediaLookup>[0]
  detail: {
    intro: string
    heading: string
    overview: string
    included: string[]
    callout: string
  }
}

// Detail copy for Alarm Responses comes from the design; the other services
// reuse company facts from elsewhere on the site until final copy is supplied.
const SERVICES: ServiceCopy[] = [
  {
    slug: "alarm-responses",
    title: "Alarm Responses",
    description: "Rapid response to alarm activations, day or night.",
    icon: "/images/service-alarm.png",
    detail: {
      intro:
        "Our highly trained security team will be dispatched to your premises and deal with the situation, day or night.",
      heading: "Fast, professional alarm response",
      overview:
        "Security Partners Ltd specialise in alarm response and key holding services. Our highly trained security team will be dispatched to your premises and deal with the situation, giving you the peace of mind your premises is safe and secure in our hands.",
      included: [
        "Rapid dispatch of trained, uniformed officers to your premises",
        "Key holding, so your site can be accessed and secured without calling you out",
        "A dedicated 24/7 Operations Team on call for every activation",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Alarm activated? Call our 24 Hour Number",
    },
  },
  {
    slug: "mobile-patrols-key-holding",
    title: "Mobile Patrols & Key Holding",
    description: "Scheduled patrols and secure key holding for your premises.",
    icon: "/images/service-patrols.png",
    detail: {
      intro:
        "Scheduled patrols and secure key holding, so your premises are checked and accessible whenever you need.",
      heading: "Visible patrols, secure key holding",
      overview:
        "Our mobile patrol officers carry out scheduled checks of your premises, deterring intruders and spotting issues early. With our key holding service, your keys are held securely so your site can be accessed and secured without calling you out.",
      included: [
        "Scheduled patrols planned around your premises",
        "Secure key holding for fast access to your site",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need a patrol or key holder? Call our 24 Hour Number",
    },
  },
  {
    slug: "open-up-lock-ups",
    title: "Open Up & Lock Ups",
    description: "Reliable opening and locking of sites on your schedule.",
    icon: "/images/service-lockups.png",
    detail: {
      intro:
        "Reliable opening and locking of your sites, on your schedule, so you never have to make the trip yourself.",
      heading: "Your site, opened and secured on time",
      overview:
        "Our officers open up and lock up your premises at the times you set, checking that the site is secure before they leave. It is a simple way to make sure your business starts and ends each day safely.",
      included: [
        "Opening and locking of sites at times that suit you",
        "Security checks of the premises at every visit",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need a site opened or locked? Call our 24 Hour Number",
    },
  },
  {
    slug: "static-security",
    title: "Static Security",
    description: "Trained officers on site to protect people and property.",
    icon: "/images/service-static.png",
    detail: {
      intro:
        "Trained, uniformed officers on site to protect your people, property and assets.",
      heading: "Trained officers, on site",
      overview:
        "Our static security officers provide a visible, professional presence at your premises. Every officer receives exceptional training so you get a first class service, backed by our dedicated 24/7 Operations Team.",
      included: [
        "Trained, uniformed officers on your premises",
        "Access control and monitoring of people and property",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need officers on site? Call our 24 Hour Number",
    },
  },
  {
    slug: "commercial-retail-security",
    title: "Commercial & Retail Security",
    description: "Tailored security for offices, shops and retail centres.",
    icon: "/images/service-commercial.png",
    detail: {
      intro:
        "Tailored security for offices, shops and retail centres, planned around how your business runs.",
      heading: "Security tailored to your business",
      overview:
        "We work with commercial and retail clients to put the right security in place, from officers on the shop floor to patrols and alarm response. Every service is planned around your premises and your schedule.",
      included: [
        "Security planned around your premises and opening hours",
        "Trained officers for offices, shops and retail centres",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Need commercial security? Call our 24 Hour Number",
    },
  },
  {
    slug: "event-security",
    title: "Event Security",
    description:
      "Professional crowd and access control for events of any size.",
    icon: "/images/service-event.png",
    detail: {
      intro:
        "Professional crowd and access control for events of any size, so your guests can enjoy the day safely.",
      heading: "Safe, well-run events",
      overview:
        "Our event security officers manage access, crowds and incidents so your event runs smoothly. We plan every event with you, from small private functions to large public gatherings.",
      included: [
        "Access control and crowd management",
        "Trained, uniformed officers for events of any size",
        "A dedicated 24/7 Operations Team on call",
        "Real-time reporting through our clocking and tag point systems",
        "Coverage across Ireland from our base in the midlands",
      ],
      callout: "Planning an event? Call our 24 Hour Number",
    },
  },
]

/** The six services in display order (sortOrder = index). */
export function servicesFixture(media: MediaLookup): ServiceFixture[] {
  return SERVICES.map(({ slug, title, description, icon, detail }) => ({
    slug,
    seo: {},
    content: {
      title,
      description,
      icon: media(icon),
      heroImage: media("/images/hero.jpg"),
      image: media("/images/about.png"),
      imageAlt: "Security Partners officer at work",
      detail: { ...detail, overview: paragraphs(detail.overview) },
    },
  }))
}
