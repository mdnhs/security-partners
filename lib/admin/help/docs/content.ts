import type { HelpArticle } from "../types"

export const CONTENT_DOCS: readonly HelpArticle[] = [
  {
    slug: "services",
    title: "Services",
    group: "content",
    description: "Add, edit, order and remove the services you offer.",
    lead: "Each service has a card on the Services page and a page of its own at /services/<address>. Open [All services](/admin/services) from Website › Services.",
    permission: { service: ["read"] },
    keywords: ["service", "offering", "security services"],
    sections: [
      {
        title: "Managing services",
        blocks: [],
      },
      {
        title: "Add a service",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [All services](/admin/services) and select **New service** (or press `⌘K` and choose **New service**).",
              "Fill in the **Service card**: name, card text and icon.",
              "Add **Page images** and write the **Service page**: introduction, overview, what is included and the callout.",
              "Publish. Until then the service is a draft and is not on the site.",
            ],
          },
        ],
      },
      {
        title: "Address, order and removal",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Page address** sets /services/<address>. Changing it moves the live page at once; the old address redirects to the new one.",
              "The order of the list is the order of the cards on the site.",
              "Deleting a service removes its card and its page from the site.",
            ],
          },
          {
            type: "p",
            text: "The text above and below the cards, such as **Why choose us**, is on the [Services page](/admin/website/services).",
          },
        ],
      },
    ],
  },
  {
    slug: "blog-articles",
    title: "Blog articles",
    group: "content",
    description: "Write, review, schedule and publish articles.",
    lead: "Articles are listed under Website › Blog › [Articles](/admin/insights). Authors write and submit them; editors and admins publish them.",
    permission: { article: ["read"] },
    keywords: ["insights", "post", "news", "schedule", "review", "author"],
    sections: [
      {
        title: "Writing and reviewing",
        blocks: [],
      },
      {
        title: "Write an article",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Articles](/admin/insights) and select **New article**.",
              "Add the **Title**, **Excerpt**, **Cover image**, **Lead** and **Article text**.",
              "Set the address, category and byline in the side panel.",
              "The draft saves itself. Use **Preview** to see it on the site.",
            ],
          },
        ],
      },
      {
        title: "Review and publishing",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "If your role cannot publish, select **Submit for review** when the article is ready. An editor will publish it or get back to you. Articles waiting appear under **In review**, shown to publishers as the **Review queue**.",
          },
          {
            type: "p",
            text: "Publishers can **Publish** straight away, **Schedule** for later, or **Unpublish** a live article.",
          },
          {
            type: "p",
            text: "The list filters are **All**, **Drafts**, **In review**, **Scheduled** and **Published**.",
          },
        ],
      },
      {
        title: "Publishing later",
        blocks: [],
      },
      {
        title: "Scheduling",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Select **Schedule**.",
              "Choose **Publish on**. The time is Irish time (Europe/Dublin).",
              "Confirm. The article goes live within a minute of that time.",
            ],
          },
          {
            type: "p",
            text: "Use **Reschedule** or **Cancel schedule** to change your mind.",
          },
        ],
      },
      {
        title: "The featured article",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The [Blog page](/admin/website/blog) has a **Featured article** card. The featured article cannot be unpublished or deleted until another one is chosen there.",
          },
        ],
      },
    ],
  },
  {
    slug: "blog-categories",
    title: "Blog categories",
    group: "content",
    description: "The categories articles are filed under and the blog filter.",
    lead: "[Categories](/admin/insights/categories) group articles. Those shown in the filter appear on the blog page, in the order of the list.",
    permission: { collection: ["read"] },
    keywords: ["category", "filter", "tags"],
    sections: [
      {
        title: "Manage categories",
        blocks: [
          {
            type: "list",
            items: [
              "Add a category with its name and **Address**.",
              "Tick **Show in the blog filter** to list it on the blog page.",
              "Use **Change order** to set the order of the filter.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "Categories save straight to the live site; there is no draft.",
          },
        ],
      },
    ],
  },
  {
    slug: "careers-jobs",
    title: "Careers jobs",
    group: "content",
    description: "Post a job, set its closing date and close it.",
    lead: "Jobs are under Website › Careers › [Jobs](/admin/careers). Each published job has its own page at /careers/<address> and an application form.",
    permission: { job: ["read"] },
    keywords: ["job", "vacancy", "hiring", "recruitment", "careers"],
    sections: [
      {
        title: "Managing jobs",
        blocks: [],
      },
      {
        title: "Post a job",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Jobs](/admin/careers) and select **New job**.",
              "Enter a title and address, then **Create draft**.",
              "Fill in **The role**, **Dates and status** and **Job page**.",
              "Publish.",
            ],
          },
        ],
      },
      {
        title: "Closing a job",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Closing date**: applications close at the end of this day (Irish time). The role then moves to Previous openings.",
              "**Position filled**: closes the role now, whatever the closing date.",
              "A job is open while it is published, not filled and its closing date has not passed.",
            ],
          },
          {
            type: "p",
            text: "Deleting a job keeps the applications already received. The text on the Careers page itself is on the [Careers page](/admin/website/careers).",
          },
        ],
      },
    ],
  },
  {
    slug: "team-and-clients",
    title: "Team members and client logos",
    group: "content",
    description: "The people on the Team page and the logos on the home page.",
    lead: "Team members and client logos are lists edited inside their pages: team members on [Team](/admin/website/team), client logos on [Home](/admin/website/home).",
    permission: { collection: ["read"] },
    keywords: ["team", "staff", "people", "clients", "logos"],
    sections: [
      {
        title: "The two lists",
        blocks: [],
      },
      {
        title: "Team members",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Each member has a name, role, email, **Short bio** and an optional **Photo**. Without a photo, a placeholder is shown.",
          },
        ],
      },
      {
        title: "Client logos",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Each client has a **Logo** and a **Website** address.",
          },
        ],
      },
      {
        title: "Saving and order",
        blocks: [
          {
            type: "p",
            text: "These lists save straight to the live site as soon as you save a record; there is no draft. Use **Change order** to set the order shown on the site.",
          },
        ],
      },
    ],
  },
  {
    slug: "media",
    title: "Media library",
    group: "content",
    description: "Upload images and PDFs, add alt text, set the focal point.",
    lead: "[Media](/admin/media) holds the images and PDFs used across the site.",
    permission: { media: ["read"] },
    keywords: ["images", "upload", "alt text", "focal point", "pdf"],
    sections: [
      {
        title: "Adding files",
        blocks: [],
      },
      {
        title: "Upload",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Drag files onto the screen or select **Choose files**. JPEG, PNG, WebP, AVIF, SVG and PDF files can be up to 20 MB each; Lottie animations (.json, .lottie) up to 2 MB.",
          },
        ],
      },
      {
        title: "Alt text",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Alternative text describes an image for people who cannot see it. Open a file and fill in **Alternative text**, or tick **Decorative image (no alt text needed)**. The **Missing alt text** filter finds the files still to do.",
          },
        ],
      },
      {
        title: "Looking after files",
        blocks: [],
      },
      {
        title: "Focal point",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "When an image is cropped to fit a space, the focal point stays in view. Open the file, click the important part of the image, then select **Save details**.",
          },
        ],
      },
      {
        title: "Replace or delete",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Replace file…** uploads a new file in its place, so every page using it shows the new one. The focal point is reset.",
              "**Used in** lists where the file appears.",
              "A file in use cannot be deleted: choose another file in those places first. Deleting cannot be undone.",
            ],
          },
        ],
      },
    ],
  },
]
