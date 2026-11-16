import type { HelpArticle } from "../types"

export const FAQ_DOCS: readonly HelpArticle[] = [
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    group: "faq",
    description: "Quick answers when something looks wrong.",
    lead: "Most surprises have a short answer. If yours is not here, ask one of the owners listed on the [Help](/admin/help) overview.",
    keywords: ["problem", "not working", "faq", "error", "locked out"],
    sections: [
      {
        title: "Editing and content",
        blocks: [],
      },
      {
        title: "I saved but the site did not change",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Saving keeps a draft. Select **Publish** to put it on the site. A status of **Unpublished changes** means the draft differs from the live version. See [Saving and publishing](/admin/help/saving-and-publishing).",
          },
        ],
      },
      {
        title: "I cannot find a screen",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Screens your role cannot open are hidden. Try `⌘K`; if it is not there either, ask an owner for the role you need. See [Roles and permissions](/admin/help/roles).",
          },
        ],
      },
      {
        title: "I cannot add a section to a page",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Fixed pages keep the sections they were built with; you can show, hide and reorder them in **Page sections**. To build a page from your own choice of blocks, use [Custom pages](/admin/help/custom-pages).",
          },
        ],
      },
      {
        title: "I cannot delete an image",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "A file that is still in use cannot be deleted. Open it in [Media](/admin/media), check **Used in**, and choose another file in those places first.",
          },
        ],
      },
      {
        title: "Email, sign-in and conflicts",
        blocks: [],
      },
      {
        title: "Enquiry emails are not arriving",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "Check the addresses in [Enquiries settings](/admin/settings/leads).",
              "Check that [Email (SMTP)](/admin/settings/integrations) is set up and passes **Test connection**.",
              "Open the enquiry: its **Activity** shows whether each email was sent.",
            ],
          },
        ],
      },
      {
        title: "I lost my phone",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Sign in with one of your backup codes (**Use a backup code instead**), then set two-factor up again in [Account](/admin/account). Without a backup code, no admin screen can turn two-factor off for you: ask an owner, who will need whoever runs the server.",
          },
        ],
      },
      {
        title: "Someone else changed this",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Another person saved the same record while you were editing. Choose **Copy mine, then reload** to keep a copy of your text, **Reload their version**, or **Overwrite with mine**.",
          },
        ],
      },
      {
        title: "Operations runbook",
        blocks: [
          {
            type: "p",
            text: "Server tasks are described in the operations runbook (docs/runbook.md) kept with the site's code, for whoever runs the server. Its guides include:",
          },
          {
            type: "list",
            items: [
              "Owner locked out",
              "Sessions and sign-in",
              "Backups and the restore drill",
              "Restore a backup",
              "Custom code and Content-Security-Policy",
              "Background jobs",
            ],
          },
        ],
      },
    ],
  },
]
