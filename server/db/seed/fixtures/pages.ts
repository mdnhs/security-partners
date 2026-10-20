import "server-only"

import type { Seo } from "@/lib/schemas/common"
import type { PageData, PageKey } from "@/templates/registry"

import type { MediaLookup } from "./media"
import { doc, heading2, paragraph } from "./rich-text"

export type PageFixture<K extends PageKey> = { data: PageData<K>; seo: Seo }
export type PagesFixture = { [K in PageKey]: PageFixture<K> }

/** Seed data for the eight fixed pages, copied verbatim from the static site. */
export function pagesFixture(media: MediaLookup): PagesFixture {
  return {
    home: {
      seo: {},
      data: {
        hero: {
          eyebrow: "Mountmellick, Co. Laois  •  Since 2008",
          heading: "Security Partners Ltd.",
          tagline: "Watching Over You",
          subheading:
            "Proactive, flexible and customer-focused security services across Ireland, backed by a dedicated 24/7 operations team.",
          backgroundImage: media("/images/hero.jpg"),
          primaryCta: { label: "Our Services", href: "#services" },
          secondaryCta: {
            label: "Call 24/7: {phone24h}",
            href: "{phone24hHref}",
          },
          stats: [
            {
              value: "18+",
              label: "Years in business",
              count: 18,
              suffix: "+",
            },
            { value: "24/7", label: "Operations team" },
            { value: "Nationwide", label: "Coverage across Ireland" },
          ],
        },
        services: {
          eyebrow: "What we do",
          heading: "Our Services",
          intro:
            "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
        },
        team: {
          eyebrow: "Our people",
          heading: "Meet The Team",
          intro: "The people behind Security Partners.",
        },
        blog: {
          eyebrow: "News & insights",
          heading: "From Our Blog",
          intro:
            "Security tips, company news and advice from the Security Partners team.",
          cta: { label: "View All Posts", href: "/blog" },
          count: 3,
        },
      },
    },
    about: {
      seo: {
        title: "About Us | Security Partners Ltd.",
        description:
          "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "About Us",
          title: "About Security Partners",
          description:
            "A family-run security company based in Mountmellick, Co. Laois, providing first class security services across Ireland since 2008.",
        },
        stats: [
          {
            value: "2008",
            label: "Founded",
            description:
              "Family-run, and grown through the years by word of mouth.",
          },
          {
            value: "24/7",
            label: "Operations Team",
            description:
              "There for all your security requirements, day or night.",
          },
          {
            value: "Nationwide",
            label: "Coverage",
            description:
              "Our midlands base lets us carry out contracts throughout Ireland.",
          },
          {
            value: "Real-time",
            label: "Reporting",
            description:
              "Clocking and tag point systems you can view as they happen.",
          },
        ],
        values: {
          eyebrow: "Our values",
          title: "What We Stand For",
          description:
            "Security Partners Ltd has an excellent reputation for providing a proactive, flexible and quality service that is completely customer focused.",
          items: [
            {
              title: "Proactive",
              description:
                "We deal with risks early, safeguarding your business, your investment and your peace of mind.",
              icon: media("/images/icon-shield.svg"),
            },
            {
              title: "Flexible",
              description:
                "Services planned around your premises and your schedule, from a single alarm response to full-time guarding.",
              icon: media("/images/icon-clock.svg"),
            },
            {
              title: "Customer Focused",
              description:
                "Exceptional training for every officer, and a dedicated point of contact for every query.",
              icon: media("/images/icon-users.svg"),
            },
          ],
        },
      },
    },
    services: {
      seo: {
        title: "Our Services | Security Partners Ltd.",
        description:
          "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
      },
      data: {
        hero: {
          image: media("/images/banner.png"),
          crumb: "Services",
          title: "Our Services",
          description:
            "Professional security solutions for every sector, from a single alarm response to full-time static guarding.",
        },
        servicesSection: {
          eyebrow: "What we do",
          heading: "Security For Every Sector",
          intro:
            "Six specialist services, all backed by our dedicated 24/7 Operations Team.",
        },
      },
    },
    team: {
      seo: {
        title: "Our Team | Security Partners Ltd.",
        description:
          "The experienced people behind Security Partners, from operations to HR and accounts.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Our Team",
          title: "Meet The Team",
          description:
            "The experienced people behind Security Partners, from operations to HR and accounts.",
        },
        leadership: {
          eyebrow: "Our people",
          heading: "Leadership & Management",
          intro: "Contact the right person directly for your query.",
          photoPlaceholder: media("/images/team-temp.jpg"),
        },
        officers: {
          eyebrow: "On the ground",
          title: "Our Officers",
          description:
            "Behind our management team is a team of licensed, uniformed officers working across Ireland.",
          qualities: [
            {
              title: "Exceptional Training",
              description:
                "Exceptional training is provided to our staff so you get a first class service.",
              icon: media("/images/icon-award.svg"),
            },
            {
              title: "Licensed & Uniformed",
              description:
                "Clearly identifiable officers who provide a visible deterrent on your premises.",
              icon: media("/images/icon-shield.svg"),
            },
            {
              title: "Experienced Teams",
              description:
                "Officers with years of experience in hotels, bars, retail and high profile late venues.",
              icon: media("/images/icon-users.svg"),
            },
          ],
        },
      },
    },
    blog: {
      seo: {
        title: "News & Insights | Security Partners Ltd.",
        description:
          "Security tips, company news and advice from the Security Partners team.",
      },
      data: {
        hero: {
          image: media("/images/banner.png"),
          crumb: "Blog",
          title: "News & Insights",
          description:
            "Security tips, company news and advice from the Security Partners team.",
        },
        featuredArticle: "18-years-of-watching-over-ireland",
        pageSize: 6,
      },
    },
    contact: {
      seo: {
        title: "Contact Us | Security Partners Ltd.",
        description:
          "Get in touch with our team. For urgent matters, our 24 Hour Number is {phone24h}.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Contact",
          title: "Contact Us",
          description:
            "Get in touch with our team. For urgent matters, our 24 Hour Number is {phone24h}.",
        },
        departments: {
          eyebrow: "Departments",
          heading: "Reach The Right Team",
          intro:
            "Contact the right person directly for faster help with your query.",
          items: [
            {
              title: "Operations",
              icon: media("/images/icon-shield.svg"),
              name: "John McDonald",
              role: "Operations Director",
              lines: [
                { text: "Tel: {office} Ext 2", href: "{officeHref}" },
                {
                  text: "or {operationsMobile}",
                  href: "{operationsMobileHref}",
                },
                {
                  text: "{operationsEmail}",
                  href: "mailto:{operationsEmail}",
                },
              ],
            },
            {
              title: "HR",
              icon: media("/images/icon-users.svg"),
              name: "Sarah Moran",
              role: "HR/Operations Manager",
              lines: [
                { text: "Tel: (085) 8062369", href: "tel:+353858062369" },
                {
                  text: "HR@securitypartnersltd.com",
                  href: "mailto:HR@securitypartnersltd.com",
                },
              ],
            },
            {
              title: "Accounts",
              icon: media("/images/icon-file.svg"),
              name: "Louise Sheeran",
              role: "Accounts Manager",
              lines: [
                { text: "Tel: (057) 8697670 Ext 3", href: "{officeHref}" },
                {
                  text: "accounts@securitypartnersltd.com",
                  href: "mailto:accounts@securitypartnersltd.com",
                },
              ],
            },
          ],
        },
      },
    },
    privacy: {
      seo: {
        title: "Privacy Policy | Security Partners Ltd.",
        description:
          "How Security Partners Ltd collects, uses and protects personal information.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Privacy Policy",
          title: "Privacy Policy",
          description:
            "How Security Partners Ltd collects, uses and protects personal information.",
        },
        // Placeholder copy (docs/brief.md open question): owner to review.
        body: doc(
          paragraph(
            "This privacy policy is a placeholder awaiting review by Security Partners Ltd. It explains how we handle personal information you share with us through this website."
          ),
          heading2("Information we collect"),
          paragraph(
            "When you contact us we collect the details you provide, such as your name, email address, phone number and message, so that we can respond to your enquiry."
          ),
          heading2("How we use it"),
          paragraph(
            "We use your details only to answer your enquiry and to provide our services. We do not sell your information to anyone."
          ),
          heading2("Your rights"),
          paragraph(
            "You can ask us for a copy of the information we hold about you, or ask us to correct or delete it, by emailing info@securitypartnersltd.com."
          )
        ),
      },
    },
    terms: {
      seo: {
        title: "Terms of Use | Security Partners Ltd.",
        description: "The terms that apply when you use this website.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Terms",
          title: "Terms of Use",
          description: "The terms that apply when you use this website.",
        },
        // Placeholder copy (docs/brief.md open question): owner to review.
        body: doc(
          paragraph(
            "These terms are a placeholder awaiting review by Security Partners Ltd. By using this website you agree to them."
          ),
          heading2("Using this website"),
          paragraph(
            "The content of this website is for general information about our services. It may change without notice."
          ),
          heading2("Contact"),
          paragraph(
            "Questions about these terms can be sent to info@securitypartnersltd.com."
          )
        ),
      },
    },
  }
}
