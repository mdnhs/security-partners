import type { HelpArticle } from "../types"

const PAGE_READ = {
  page: ["read"],
} as const satisfies HelpArticle["permission"]

export const WEBSITE_DOCS: readonly HelpArticle[] = [
  {
    slug: "website-pages",
    title: "Editing a page",
    group: "website",
    description: "The Website menu, page forms, the SEO tab and Publish.",
    lead: "Sidebar › **Website** has one screen per page of the public site. Each screen holds that page's whole form: its text, images and the sections it shares with other pages, saved as one draft and published together.",
    permission: PAGE_READ,
    keywords: ["pages", "home page", "about", "contact", "hero", "website"],
    sections: [
      {
        title: "Pages in the admin",
        blocks: [],
      },
      {
        title: "The Website menu",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The screens are [Home](/admin/website/home), [About](/admin/website/about), [Services](/admin/website/services), [Team](/admin/website/team), [Blog](/admin/website/blog), [Contact](/admin/website/contact), [Careers](/admin/website/careers), [Custom pages](/admin/website/custom-pages), [Legal pages](/admin/website/legal) and [Header & footer](/admin/website/header-footer).",
          },
          {
            type: "p",
            text: "The page screens are fixed: you edit them, but you cannot add or remove one. New items are added inside them instead: services, articles, jobs, legal pages and custom pages.",
          },
        ],
      },
      {
        title: "Cards in the form",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "The form is a column of cards, one per part of the page, in the order the page shows them. The home page starts with **Hero**; the other pages with **Page hero**.",
              "Sections shared with other pages, such as the contact details on [Contact](/admin/website/contact) or **Why choose us** on [Services](/admin/website/services), are edited on the page named for them. A change shows everywhere the section appears.",
              "Lists that sit on a page, such as the client logos on [Home](/admin/website/home) and the team members on [Team](/admin/website/team), are cards in the form too. They save straight away, without a draft.",
              "[Blog](/admin/website/blog) and [Careers](/admin/website/careers) also have tabs for their lists: **Articles** and **Categories**, and **Jobs**.",
            ],
          },
        ],
      },
      {
        title: "Editing a page",
        blocks: [],
      },
      {
        title: "Editing and publishing",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open the page under **Website**.",
              "Edit the cards. The draft saves itself.",
              "Check it with **Live preview** or **Preview**.",
              "Select **Publish**.",
            ],
          },
        ],
      },
      {
        title: "The SEO tab",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Each page form has two tabs: **Content** and **SEO**. The SEO tab sets the **Title** and **Description** search engines show, the **Share image**, a **Canonical address**, **Hide from search engines**, and the social title and description.",
          },
          {
            type: "callout",
            tone: "note",
            text: "SEO changes are saved to the live page as soon as you save them; they do not wait for **Publish**.",
          },
        ],
      },
    ],
  },
  {
    slug: "page-sections",
    title: "Page sections",
    group: "website",
    description: "Show, hide and reorder the sections below the hero.",
    lead: "Several pages have a **Page sections** card. It decides which sections appear below the hero, and in what order.",
    permission: PAGE_READ,
    keywords: ["order", "reorder", "hide", "show", "layout"],
    sections: [
      {
        title: "Using page sections",
        blocks: [],
      },
      {
        title: "Showing, hiding and reordering",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open the page, for example [Home](/admin/website/home), and find **Page sections**.",
              "Use the switch on a row to show or hide that section.",
              "Use **Move up** and **Move down** to change the order.",
              "Publish the page.",
            ],
          },
          {
            type: "p",
            text: "The hero is always first (**Hero: always first**) and cannot be moved. Hiding a section keeps its content, so you can show it again later.",
          },
        ],
      },
      {
        title: "Which pages have it",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Home**: About, Services, Enquiry banner, Clients, Team, Blog, Contact form, Location map.",
              "**About**: About, Stats, Values, Clients, Enquiry banner.",
              "**Services**: Services, Why choose us, Clients, Enquiry banner.",
              "**Team**: Leadership, Officers, Enquiry banner.",
              "**Contact**: Contact form, Departments, Location map.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "A fixed page cannot gain new sections: the list holds the sections that page was built with. For a page made of your own choice of blocks, use [Custom pages](/admin/help/custom-pages).",
          },
        ],
      },
    ],
  },
  {
    slug: "header-footer",
    title: "Header & footer",
    group: "website",
    description: "The menu, footer text, group companies and small labels.",
    lead: "[Header & footer](/admin/website/header-footer) is one form with three tabs. Changes stay in a draft until you publish.",
    permission: { settings: ["read"] },
    keywords: ["menu", "navigation", "navbar", "footer", "microcopy"],
    sections: [
      {
        title: "The three tabs",
        blocks: [],
      },
      {
        title: "Header",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The links across the top of every page and the highlighted button. The same links appear as the quick links in the footer.",
          },
        ],
      },
      {
        title: "Footer",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Footer text and headings, and the privacy and terms links. The **Group companies** card at the end of this tab lists the companies shown in the footer; it saves straight away, without a draft.",
          },
          {
            type: "p",
            text: "Further legal pages are linked from the footer automatically once published. See [Legal pages](/admin/help/legal-pages).",
          },
        ],
      },
      {
        title: "Forms & microcopy",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Small labels used across the site: button text, form messages and labels read out by screen readers.",
          },
        ],
      },
    ],
  },
  {
    slug: "custom-pages",
    title: "Custom pages",
    group: "website",
    description: "Build extra pages from blocks at their own /p/ address.",
    lead: "[Custom pages](/admin/website/custom-pages) are pages you build from blocks, each at its own address under /p/.",
    permission: PAGE_READ,
    keywords: ["builder", "blocks", "landing page", "new page"],
    sections: [
      {
        title: "Working with custom pages",
        blocks: [],
      },
      {
        title: "Create a page",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Custom pages](/admin/website/custom-pages) and select **New page**.",
              "Enter a **Title** and an **Address**.",
              "Select **Create page**. The page is a draft: nobody sees it until you publish it.",
            ],
          },
          {
            type: "p",
            text: "Changing the address of a published page later adds a redirect from the old address, so links keep working.",
          },
        ],
      },
      {
        title: "Blocks",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Select **Add a block** to choose from **Page hero**, **About**, **Stats**, **Icon cards**, **Services**, **Why choose us**, **Enquire banner**, **Clients**, **Team**, **Blog**, **Departments**, **Contact**, **Map** and **Text**. Most section blocks can be used once per page.",
          },
          {
            type: "p",
            text: "Each block can be moved, duplicated or deleted. The draft saves itself; **Discard unpublished changes?** takes the draft back to the published page.",
          },
          {
            type: "p",
            text: "The page's search settings are in the **Search and sharing** card.",
          },
        ],
      },
    ],
  },
  {
    slug: "legal-pages",
    title: "Legal pages",
    group: "website",
    description: "Privacy, terms, and extra policies such as a cookie policy.",
    lead: "[Legal pages](/admin/website/legal) holds the **Privacy policy** and **Terms of use**, plus any other policy you add.",
    permission: PAGE_READ,
    keywords: ["privacy", "terms", "cookie policy", "policy", "gdpr"],
    sections: [
      {
        title: "Managing legal pages",
        blocks: [],
      },
      {
        title: "Edit a legal page",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Open the page from the list, edit the text and publish it, as for any other page.",
          },
        ],
      },
      {
        title: "Add a legal page",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Select **New legal page**.",
              "Enter the title and the **Address**. The page will be at that address on the site.",
              "Write the text and publish it.",
            ],
          },
          {
            type: "p",
            text: "Published legal pages are linked from the footer after Privacy and Terms, in the order of the list. Drag a row, or use **Move up** and **Move down**, to change that order.",
          },
          {
            type: "p",
            text: "Pages you added can be deleted; Privacy and Terms cannot.",
          },
        ],
      },
    ],
  },
]
