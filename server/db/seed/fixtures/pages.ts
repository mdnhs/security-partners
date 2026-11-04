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
    careers: {
      seo: {
        title: "Careers | Security Partners Ltd.",
        description:
          "Security jobs with a family-run Irish company. Open positions, our hiring process and how to apply.",
      },
      data: {
        hero: {
          image: media("/images/hero.jpg"),
          crumb: "Careers",
          title: "Careers",
          description:
            "Build a career in security with a family-run Irish company protecting homes and businesses since 2008.",
        },
        whyJoin: {
          eyebrow: "Why join us",
          title: "Why Join Security Partners",
          description:
            "Steady work, proper training and a management team that knows your name.",
          cards: [
            {
              title: "PSA Licence Support",
              description:
                "We cover your PSA licence renewal and keep your training and refreshers up to date.",
              icon: media("/images/icon-shield.svg"),
            },
            {
              title: "Steady Rosters",
              description:
                "Fixed shift patterns with rosters issued a month in advance — plan your life around work.",
              icon: media("/images/icon-clock.svg"),
            },
            {
              title: "Family-Run Since 2008",
              description:
                "A local Laois company where you're part of the team, not just a number.",
              icon: media("/images/icon-users.svg"),
            },
            {
              title: "Career Progression",
              description:
                "Move into supervision, our 24hr monitoring centre or security installations.",
              icon: media("/images/icon-chart.svg"),
            },
          ],
        },
        openings: {
          eyebrow: "Now hiring",
          title: "Open Positions",
          description:
            "All roles require a valid PSA licence for the relevant category unless stated. New positions are added every week.",
          countLabel: "{count} open roles",
          searchPlaceholder: "Search by job title or keyword",
          allLocations: "All Locations",
          allLicenceTypes: "All Licence Types",
          allRoles: "All Roles ({count})",
          viewJobLabel: "View Job",
          postedLabel: "Posted {ago}",
          emptyTitle: "No open positions right now",
          emptyText:
            "New roles are added every week. Send us your CV and we'll contact you when a suitable position opens.",
        },
        previous: {
          eyebrow: "Closed roles",
          title: "Previous Openings",
          description:
            "These positions have now been filled. Join our talent pool below to hear about similar roles first.",
          closedOnLabel: "Closed on {date}",
          filledLabel: "Position Filled",
        },
        process: {
          eyebrow: "How it works",
          title: "Our Hiring Process",
          description:
            "From application to your first shift — usually within two to three weeks, including screening.",
          steps: [
            {
              title: "Apply Online",
              description:
                "Send your details, PSA licence information and CV in about 5 minutes.",
            },
            {
              title: "Phone Screen",
              description:
                "Our HR team verifies your licence and talks through availability and sites.",
            },
            {
              title: "Interview & Screening",
              description:
                "A face-to-face interview, 5-year history verification and Garda vetting.",
            },
            {
              title: "Induction & Site Training",
              description:
                "Paid induction, site familiarisation and uniform fitting before your first shift.",
            },
          ],
        },
        cta: {
          eyebrow: "Talent pool",
          heading: "Don’t see the right role?",
          copy: "Join our talent pool and we'll contact you when a suitable position opens. We recruit licensed officers across the Midlands all year round.",
          primary: {
            label: "Send Us Your CV",
            href: "mailto:HR@securitypartnersltd.com",
          },
          secondary: {
            label: "Call HR (085) 806 2369",
            href: "tel:+353858062369",
          },
        },
        tags: {
          open: "Open",
          urgent: "Urgent",
          nowHiring: "Now Hiring",
          closed: "Closed",
        },
        job: {
          applyLabel: "Apply Now",
          shareLabel: "Share Job",
          copiedLabel: "Link copied",
          aboutHeading: "About the Role",
          responsibilitiesHeading: "Key Responsibilities",
          lookingForHeading: "What We’re Looking For",
          essentialLabel: "Essential",
          essentialTag: "Required",
          desirableLabel: "Desirable",
          desirableTag: "Nice to have",
          offerHeading: "What We Offer",
          equalOpportunity:
            "Security Partners is an equal opportunities employer. We welcome applications from everyone regardless of gender, civil or family status, sexual orientation, religion, age, disability, race or membership of the Traveller community. If you need any reasonable accommodation during the recruitment process, just let us know.",
          closedNotice:
            "This role has closed and is no longer accepting applications. See our open positions, or join our talent pool.",
          summary: {
            heading: "Job Summary",
            reference: "Job Reference",
            location: "Location",
            jobType: "Job Type",
            hours: "Hours",
            pay: "Pay",
            startDate: "Start Date",
            closingDate: "Closing Date",
            applyLabel: "Apply for This Job",
            shareLabel: "Share this job",
          },
          questions: {
            heading: "Questions about this role?",
            copy: "Talk to Sarah Moran, our HR/Operations Manager.",
            phone: "(085) 806 2369",
            phoneHref: "tel:+353858062369",
            email: "HR@securitypartnersltd.com",
          },
          beforeYouApply: {
            heading: "Before You Apply",
            intro: "Have these ready to make applying quick:",
            items: [
              "Your PSA licence number and expiry date",
              "Your employment history for the last 5 years",
              "Proof of your right to work in Ireland",
              "An up-to-date CV (PDF or Word)",
            ],
          },
          similar: {
            eyebrow: "More opportunities",
            heading: "Similar Roles",
            viewAllLabel: "View All Jobs",
            viewJobLabel: "View Job",
          },
        },
        apply: {
          heroTitle: "Apply for This Role",
          crumb: "Apply",
          referenceLabel: "Ref {reference}",
          backLabel: "Back to job details",
          title: "Application Form",
          intro:
            "It takes about 8 minutes. Fields marked * are required. Have your PSA licence and 5-year history to hand.",
          sections: [
            {
              title: "Personal Details",
              subtitle: "How we can contact you about your application.",
            },
            {
              title: "Right to Work in Ireland",
              subtitle:
                "We need to confirm you can legally work the hours this role requires.",
            },
            {
              title: "PSA Licence",
              subtitle:
                "A valid Private Security Authority licence is a legal requirement for this role.",
            },
            {
              title: "5-Year History & Screening",
              subtitle:
                "PSA standards require us to verify your full history for the last 5 years.",
            },
            {
              title: "Experience & Availability",
              subtitle: "Help us match you to the right site and roster.",
            },
            {
              title: "CV & Cover Note",
              subtitle:
                "Upload your CV and tell us anything else we should know.",
            },
            { title: "Declaration & Consent", subtitle: "" },
          ],
          fields: {
            firstName: { label: "First Name", placeholder: "e.g. John" },
            surname: { label: "Surname", placeholder: "e.g. Murphy" },
            email: { label: "Email Address", placeholder: "you@email.com" },
            phone: { label: "Mobile Number", placeholder: "085 000 0000" },
            address: { label: "Address", placeholder: "Street address" },
            town: {
              label: "Town / County",
              placeholder: "e.g. Portlaoise, Co. Laois",
            },
            eircode: { label: "Eircode", placeholder: "e.g. R32 YX49" },
            rightToWork: {
              label: "Which best describes your permission to work in Ireland?",
              placeholder: "",
            },
            permissionExpiry: {
              label: "Permission Expiry Date (if applicable)",
              placeholder: "",
            },
            psaHeld: {
              label: "Do you hold a valid PSA licence?",
              placeholder: "",
            },
            psaNumber: {
              label: "PSA Licence Number",
              placeholder: "e.g. 01234567",
            },
            psaCategory: {
              label: "Licence Category",
              placeholder: "Select a category",
            },
            psaExpiry: { label: "Licence Expiry Date", placeholder: "" },
            psaCard: {
              label: "Copy of PSA Card (front & back)",
              placeholder: "Upload PSA card",
            },
            qualifications: {
              label: "Training & qualifications you hold",
              placeholder: "",
            },
            employer: {
              label: "Employer / Activity",
              placeholder: "e.g. Advance Security Ltd",
            },
            role: {
              label: "Job Title / Role",
              placeholder: "e.g. Static Security Officer",
            },
            from: { label: "From", placeholder: "" },
            to: { label: "To", placeholder: "Present" },
            reason: {
              label: "Reason for Leaving",
              placeholder: "e.g. Contract ended",
            },
            gardaVetting: {
              label:
                "Are you willing to undergo Garda vetting and background screening?",
              placeholder: "",
            },
            livedAbroad: {
              label:
                "Have you lived outside Ireland for 6 months or more in the last 5 years?",
              placeholder: "",
            },
            experience: {
              label: "Security Experience in Ireland",
              placeholder: "Select years",
            },
            startDate: { label: "Earliest Start Date", placeholder: "" },
            shifts: { label: "Which shifts can you work?", placeholder: "" },
            transport: {
              label:
                "Do you have a full driving licence and your own transport?",
              placeholder: "",
            },
            cv: { label: "Upload Your CV", placeholder: "" },
            coverNote: {
              label: "Cover Note (optional)",
              placeholder:
                "Tell us about your security experience and why you’d like to join Security Partners…",
            },
            heardFrom: {
              label: "How did you hear about this job?",
              placeholder: "Select an option",
            },
          },
          options: {
            rightToWork: [
              "Irish or UK citizen",
              "EU / EEA / Swiss citizen",
              "Stamp 4 or Stamp 5",
              "Stamp 1G (Graduate)",
              "Stamp 1 (Employment Permit)",
              "Stamp 2 (Student)",
            ],
            psaHeld: [
              "Yes – valid licence",
              "Applied – awaiting decision",
              "No",
            ],
            psaCategory: [
              "Security Guard (Static)",
              "Door Supervisor",
              "Security Guard (Event)",
              "Monitoring Centre Operative",
              "Alarm Monitoring",
              "Installer (Intruder Alarm / CCTV)",
            ],
            qualifications: [
              "QQI Level 4 Guarding Skills",
              "First Aid Responder (FAR)",
              "Manual Handling",
              "Fire Warden",
              "CCTV Operations",
              "Door Security Procedures",
            ],
            experience: [
              "No experience yet",
              "Less than 1 year",
              "1–2 years",
              "3–5 years",
              "More than 5 years",
            ],
            shifts: [
              "Days",
              "Nights",
              "Weekends",
              "12-hour shifts",
              "4-on-4-off roster",
              "Bank holidays",
            ],
            heardFrom: [
              "Our website",
              "Indeed",
              "Facebook",
              "LinkedIn",
              "A friend or colleague",
              "Other",
            ],
            yes: "Yes",
            no: "No",
          },
          hints: {
            rightToWork:
              "This is a full-time role. Stamp 2 holders can only work up to 20 hours per week during term time. We’ll ask to see proof of your permission at interview.",
            history:
              "List all employment, education and any gaps (e.g. travel, caring, unemployment) from the most recent backwards, covering at least the last 5 years.",
            period: "Period {n}",
            mostRecent: "Most recent",
            addPeriod: "Add another period",
            removePeriod: "Remove this period",
            livedAbroad:
              "If yes, we’ll ask for a police clearance certificate from each country you lived in.",
            psaCardTypes: "JPG/PDF",
            cvDrop: "Drag & drop your CV here,",
            cvBrowse: "or browse files",
            cvTypes: "PDF, DOC or DOCX · Max 5MB",
            fileTooLarge: "This file is larger than 5MB.",
            fileWrongType: "This file type is not accepted.",
            required: "Required",
          },
          consents: [
            "I confirm that the information in this application is true and complete, and I understand that false information may lead to my application being withdrawn.",
            "I agree to Security Partners processing my personal data for this application, including PSA licence and reference checks, in line with the Privacy Notice.",
            "Keep my details on file for 12 months and contact me about future roles.",
          ],
          equalOpportunity:
            "Security Partners is an equal opportunities employer. We do not ask for your age, date of birth, marital or family status. If you need any reasonable accommodation during the process, please tell us in your cover note.",
          submitLabel: "Submit Application",
          sendingLabel: "Sending…",
          secureNote:
            "Your information is encrypted and handled in line with GDPR.",
          successTitle: "Application sent",
          successText:
            "Thank you. Our HR team will review your application within 3 working days of the closing date and contact you by phone or email.",
          closedNotice:
            "This role has closed and is no longer accepting applications.",
          sidebar: {
            applyingFor: "You’re applying for",
            viewJob: "View job details",
            nextHeading: "What Happens Next",
            nextSteps: [
              {
                title: "We review your application",
                description: "Within 3 working days of the closing date.",
              },
              {
                title: "Phone screen & PSA check",
                description:
                  "We verify your licence on the PSA public register.",
              },
              {
                title: "Interview & screening",
                description:
                  "Interview, 5-year history checks and Garda vetting.",
              },
            ],
            dataHeading: "Your Data Is Safe",
            dataCopy:
              "We only use your details for recruitment. Unsuccessful applications are deleted after 12 months unless you ask us to keep them, in line with GDPR.",
            helpHeading: "Need Help Applying?",
          },
        },
      },
    },
  }
}
