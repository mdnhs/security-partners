import "server-only"

import type { SettingsKey, SettingsValue } from "@/lib/schemas/settings"
import { DEFAULT_CONFIRM_PAGE } from "@/lib/schemas/settings/newsletter"
import { DEFAULT_THEME } from "@/lib/theme/schema"

import type { MediaLookup } from "./media"
import { paragraphs } from "./rich-text"

export type SettingsFixture = { [K in SettingsKey]: SettingsValue<K> }

/**
 * Seed values for every settings key, copied verbatim from the static site
 * (docs/brief-inventory.json). {placeholders} are filled in at render
 * (lib/interpolate.ts), so contact numbers are edited once.
 */
export function settingsFixture(media: MediaLookup): SettingsFixture {
  return {
    site: {
      name: "Security Partners Ltd.",
      legalName: "Security Partners Ltd.",
      logo: media("/images/logo.png"),
      logoAlt: "Security Partners Ltd.",
      logoOnDark: null,
      favicon: null,
      productionUrl: null,
      timezone: "Europe/Dublin",
      locale: "en",
      copyright: "© 2026 Security Partners Ltd. All rights reserved.",
    },
    contact: {
      phone24h: "(085) 8018746",
      office: "057 8697670",
      operationsMobile: "085 859 1299",
      operationsExtension: "Ext 2",
      email: "info@securitypartnersltd.com",
      operationsEmail: "operations@securitypartnersltd.com",
      hours: "Monday–Friday, 9am to 6pm",
      addressLine1: "Derryguile, Mountmellick",
      addressLine2: "Co. Laois, R32 YX49",
      mapsHref:
        "https://www.google.com/maps/search/?api=1&query=Security+Partners+Ltd+Derryguile+Mountmellick+Co.+Laois+R32+YX49",
    },
    navigation: {
      headerLinks: [
        { label: "About", href: "/about" },
        { label: "Services", href: "/services" },
        { label: "Team", href: "/team" },
        { label: "Blog", href: "/blog" },
        { label: "Contact", href: "/contact" },
      ],
      headerCta: { label: "Get a Quote", href: "/contact" },
    },
    footer: {
      tagline:
        "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
      quickLinksHeading: "Quick Links",
      contactHeading: "Contact",
      contact: { telLabel: "Tel:", phone24hLabel: "24hr:" },
      groupHeading: "OTHER SERVICES IN THE GROUP",
      groupTelLabel: "Tel:",
      legal: {
        privacy: { label: "Privacy Policy", href: "/privacy" },
        terms: { label: "Terms", href: "/terms" },
      },
    },
    "sections.enquireBanner": {
      image: media("/images/banner.png"),
      eyebrow: "Get in touch",
      heading: "Enquire About Our Services",
      copy: "Tell us what you need protecting and our team will come back to you with a tailored, no-obligation quote.",
      cta: { label: "Get a Quote", href: "/contact" },
      secondaryCta: { label: "Call {office}", href: "{officeHref}" },
    },
    "sections.clients": { eyebrow: "Trusted by", heading: "Our Clients" },
    "sections.whyChooseUs": {
      eyebrow: "Why Security Partners",
      heading: "Why Choose Us",
      copy: "We are dedicated to providing our clients with the best possible services.",
      features: [
        {
          title: "24/7 Operations Team",
          description:
            "A dedicated team who are there for all your security requirements.",
          icon: media("/images/icon-clock.svg"),
        },
        {
          title: "Nationwide Coverage",
          description:
            "Our midlands location lets us carry out contracts throughout Ireland.",
          icon: media("/images/icon-map.svg"),
        },
        {
          title: "Exceptional Training",
          description:
            "Every officer is trained so you get a first class service.",
          icon: media("/images/icon-award.svg"),
        },
        {
          title: "Real-Time Reporting",
          description:
            "Clocking and tag point systems you can view in real time.",
          icon: media("/images/icon-chart.svg"),
        },
      ],
    },
    "sections.about": {
      eyebrow: "Who we are",
      heading: "A family-run security company you can trust",
      body: paragraphs(
        "Security Partners Ltd is a privately owned security company based in Mountmellick, Co. Laois. We are strategically based in the midlands, allowing us to provide services across Ireland.",
        "Since our foundation in 2008, our objective has been and still is to provide a first class service to all sectors of business. We are dedicated to safeguarding our clients' business and investment, and giving them peace of mind."
      ),
      image: media("/images/about.png"),
      imageAlt: "Security Partners officer reviewing paperwork",
      badge: {
        value: "2008",
        label: "Established",
        caption: "Mountmellick, Co. Laois",
      },
      highlights: [
        "Dedicated 24/7 Operations Team for all your security requirements",
        "Midlands location lets us carry out contracts throughout Ireland",
        "Family-run business that has grown by word of mouth",
        "Exceptional training so you get a first class service",
        "24/7 IT service with real-time reporting, clocking and tag point systems",
      ],
    },
    "sections.contact": {
      eyebrow: "Contact",
      heading: "Get In Touch",
      intro:
        "Send us a message and we'll get back to you within one working day.",
      infoItems: [
        {
          title: "Office Hours",
          icon: media("/images/clock.svg"),
          lines: [{ text: "Monday–Friday: 9am to 6pm" }],
        },
        {
          title: "24 Hour Number",
          icon: media("/images/phone.svg"),
          lines: [{ text: "{phone24h}", href: "{phone24hHref}" }],
        },
        {
          title: "Address",
          icon: media("/images/pin.svg"),
          lines: [{ text: "{addressLine1}" }, { text: "{addressLine2}" }],
        },
        {
          title: "Operations",
          icon: media("/images/mail.svg"),
          lines: [
            { text: "Tel: {office} Ext 2", href: "{officeHref}" },
            { text: "or {operationsMobile}", href: "{operationsMobileHref}" },
            { text: "{operationsEmail}", href: "mailto:{operationsEmail}" },
          ],
        },
      ],
      form: {
        nameLabel: "Your Name",
        namePlaceholder: "John Smith",
        emailLabel: "Email",
        emailPlaceholder: "you@company.ie",
        phoneLabel: "Phone",
        phonePlaceholder: "085 000 0000",
        messageLabel: "Message",
        messagePlaceholder: "Tell us about your security requirements...",
        submitLabel: "Send Message",
        sendingLabel: "Sending…",
        successMessage:
          "Thank you, your message has been sent. We will be in touch shortly.",
        errorMessage:
          "Sorry, your message could not be sent. Please try again or call us.",
        rateLimitedMessage:
          "You have sent several messages in a short time. Please wait a few minutes and try again.",
        mailtoSubject: "Website enquiry from {name}",
      },
      map: {
        link: "{mapsHref}",
        ariaLabel: "Open Security Partners Ltd. location in Google Maps",
        label: "Security Partners Ltd.",
        tiles: "/images/map/tile-{col}-{row}.png",
      },
    },
    "seo.defaults": {
      title: "Security Partners Ltd. | Watching Over You",
      titleTemplate: "{title} | Security Partners Ltd.",
      description:
        "Proactive, flexible and customer-focused security services across Ireland, backed by a dedicated 24/7 operations team. Based in Mountmellick, Co. Laois since 2008.",
      ogImage: null,
      organization: {
        type: "LocalBusiness",
        streetAddress: "Derryguile",
        addressLocality: "Mountmellick",
        addressRegion: "Co. Laois",
        postalCode: "R32 YX49",
        addressCountry: "IE",
        areaServed: "Ireland",
        sameAs: [],
      },
      robots: "index",
      verification: { google: "", bing: "" },
    },
    consent: {
      title: "We use cookies",
      body: "We use necessary cookies to run this site. With your consent we also use analytics and marketing cookies to understand how the site is used.",
      acceptLabel: "Accept all",
      rejectLabel: "Reject non-essential",
      customiseLabel: "Customise",
      saveLabel: "Save choices",
      manageLabel: "Cookie settings",
      closeLabel: "Close",
      policyLink: { label: "Privacy Policy", href: "/privacy" },
      categories: {
        necessary: {
          label: "Necessary",
          description: "Required for the site to work. Always on.",
        },
        analytics: {
          label: "Analytics",
          description: "Helps us understand how visitors use the site.",
        },
        marketing: {
          label: "Marketing",
          description: "Lets us measure our advertising.",
        },
      },
      version: 1,
      reconsentMonths: 6,
    },
    tracking: {
      enabled: false,
      gtmEnabled: false,
      gtmId: null,
      ga4Enabled: false,
      ga4Id: null,
      metaEnabled: false,
      metaPixelId: null,
    },
    customCode: { disabled: false, allowedHosts: [], snippets: [] },
    microcopy: {
      header: { phone24hLabel: "24 Hour Number:", hoursLabel: "Office hours:" },
      aria: {
        mainNav: "Main",
        openMenu: "Open menu",
        closeMenu: "Close menu",
        mobileNav: "Mobile",
        footerNav: "Footer",
        breadcrumb: "Breadcrumb",
        serviceCardReadMore: "Read more about {title}",
        allServices: "All services",
        blogFilter: "Filter posts by category",
        pagination: "Pagination",
        previousPage: "Previous page",
        pageNumber: "Page {n}",
        nextPage: "Next page",
        categories: "Categories",
        shareOn: "Share on {name}",
      },
      breadcrumb: {
        home: "Home",
        services: "Services",
        servicesHref: "/services",
        blog: "Blog",
        blogHref: "/blog",
      },
      serviceCard: { readMore: "Read More" },
      service: {
        overviewEyebrow: "Service overview",
        includedHeading: "What's included",
        allServicesHeading: "All Services",
        helpEyebrow: "Need help?",
        helpHeading: "Talk to our Operations Team",
        telLabel: "Tel:",
        orLabel: "or",
        phone24hLabel: "24 Hour Number",
        ctaLabel: "Get a Quote",
        ctaHref: "/contact",
        otherEyebrow: "More services",
        otherHeading: "Other Services",
        otherIntro: "Explore the rest of our security services.",
      },
      blog: {
        allPostsFilter: "All Posts",
        readArticle: "Read Article  →",
        featuredBadge: "Featured",
        emptyCategory: "No posts in {category} yet. Check back soon.",
      },
      article: {
        readTime: "{n} min read",
        relatedEyebrow: "Keep reading",
        relatedHeading: "Related Articles",
        tagsLabel: "Tags:",
        shareLabel: "Share:",
        recentPostsHeading: "Recent Posts",
        categoriesHeading: "Categories",
        ctaEyebrow: "Need security?",
        ctaHeading: "Protect your premises after hours",
        ctaCopy:
          "Tell us about your site and we'll come back with a tailored, no-obligation quote.",
        ctaLabel: "Get a Quote",
        ctaHref: "/contact",
      },
      share: {
        networks: [
          {
            label: "f",
            name: "Facebook",
            href: "https://www.facebook.com/sharer/sharer.php?u={url}",
          },
          {
            label: "in",
            name: "LinkedIn",
            href: "https://www.linkedin.com/sharing/share-offsite/?url={url}",
          },
          {
            label: "X",
            name: "X",
            href: "https://x.com/intent/post?url={url}&text={title}",
          },
        ],
      },
    },
    leads: {
      recipients: ["info@securitypartnersltd.com"],
      retentionMonths: 24,
      acknowledgement: false,
    },
    // Same value the *_theme migration inserts (no <style> by default).
    theme: DEFAULT_THEME,
    // Ruling 2: off by default, so the seeded site renders nothing new.
    newsletter: {
      placement: "off",
      doubleOptIn: true,
      pendingDays: 30,
      eyebrow: "Newsletter",
      title: "Security insights in your inbox",
      subtitle: "One short email a month. Unsubscribe any time.",
      emailLabel: "Email address",
      placeholder: "you@company.ie",
      button: "Subscribe",
      success: "Check your inbox to confirm your subscription.",
      errors: {
        email: "Enter a valid email address.",
        rateLimited: "Too many attempts. Please try again in a few minutes.",
        generic: "Something went wrong. Please try again.",
      },
      confirmationEmail: {
        subject: "Confirm your subscription",
        body: "Please confirm that you would like to receive the Security Partners newsletter. If you did not ask for this, ignore this email and you will not hear from us again.",
      },
      pages: {
        confirm: { ...DEFAULT_CONFIRM_PAGE },
        confirmed: {
          title: "You're subscribed",
          body: "Thanks for confirming. Our next newsletter will arrive in your inbox.",
        },
        invalid: {
          title: "This link is no longer valid",
          body: "The confirmation link has expired or was already used. Please subscribe again.",
        },
        unsubscribe: {
          title: "Unsubscribe",
          body: "Press the button below to stop receiving our newsletter.",
          button: "Unsubscribe",
        },
        unsubscribed: {
          title: "You're unsubscribed",
          body: "You will not receive any more newsletters from us.",
        },
      },
    },
  }
}
