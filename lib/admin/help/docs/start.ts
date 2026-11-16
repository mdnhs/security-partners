import type { HelpArticle } from "../types"

export const START_DOCS: readonly HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    group: "start",
    description: "Sign in, find your way around and make your first change.",
    lead: "The admin is where you edit the Security Partners website and answer the people who contact you through it. This guide covers signing in and the layout of the screen.",
    keywords: ["sign in", "login", "password", "first time"],
    sections: [
      {
        title: "Your account",
        blocks: [],
      },
      {
        title: "Signing in",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open the sign-in page and enter your **Email** and **Password**.",
              "Select **Sign in**.",
              "If two-factor authentication is on for your account, enter the 6-digit code from your authenticator app and select **Verify**.",
            ],
          },
          {
            type: "p",
            text: "Accounts are created by invitation only. The invitation email has a link to **Set your password**; the link works for 7 days. Passwords must be 12 to 128 characters.",
          },
          {
            type: "p",
            text: "Forgot your password? Select **Forgot password?** on the sign-in page and enter your email. The reset link works for 1 hour, and choosing a new password signs out your other sessions.",
          },
        ],
      },
      {
        title: "Two-factor authentication",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Two-factor authentication asks for a code from your phone as well as your password. Turn it on in [Account](/admin/account) on the **Security** tab.",
          },
          {
            type: "steps",
            items: [
              "Enter your password and select **Set up two-factor authentication**.",
              "Scan the QR code with an authenticator app, such as Google Authenticator, 1Password or Microsoft Authenticator. If you cannot scan it, use **Can't scan? Enter this key instead**.",
              "Enter the **Code from the app** and select **Turn on**.",
              "Save the backup codes somewhere safe. They are shown only once, and each one signs you in once if you lose your phone.",
            ],
          },
          {
            type: "p",
            text: "At sign-in you can tick **Trust this device for 30 days**, or choose **Use a backup code instead** when your phone is not to hand.",
          },
        ],
      },
      {
        title: "Finding your way",
        blocks: [],
      },
      {
        title: "The sidebar",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The sidebar on the left lists every area your role can open. Anything you cannot use is hidden, so two people may see different menus.",
          },
          {
            type: "list",
            items: [
              "**Menu**: [Dashboard](/admin), [Website](/admin/website), [Media](/admin/media), [Enquiries](/admin/leads), [Live chat](/admin/chat) and [Job applications](/admin/careers/applications). A number beside an item counts what is waiting.",
              "**Growth**: [SEO](/admin/seo) and [Marketing](/admin/marketing).",
              "**General**: [Appearance](/admin/appearance) and Site settings.",
              "The icons at the bottom: [Users & roles](/admin/users), [Activity log](/admin/activity), Help and **Log out**.",
            ],
          },
          {
            type: "p",
            text: "Your name in the user menu opens [Account](/admin/account), **Security**, the light, dark or system theme, and **Sign out**.",
          },
        ],
      },
      {
        title: "Where to go next",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "[Saving and publishing](/admin/help/saving-and-publishing) explains drafts, autosave and **Publish**.",
              "[Search and shortcuts](/admin/help/search-and-shortcuts) covers `⌘K` and the other keys.",
              "[Roles and permissions](/admin/help/roles) explains why some screens are missing.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "dashboard",
    title: "The dashboard",
    group: "start",
    description: "What the first screen shows and what to do next.",
    lead: "The [Dashboard](/admin) is the first screen after signing in. It shows what has come in and what needs attention, limited to the areas your role can open.",
    keywords: ["home", "overview", "next up", "kpi"],
    sections: [
      {
        title: "What the dashboard shows",
        blocks: [],
      },
      {
        title: "Figures",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**New enquiries**: the last 30 days against the 30 days before.",
              "**Open enquiries**: enquiries that are new, contacted or qualified.",
              "**Published content**, **SEO health** and **Drafts in review**.",
            ],
          },
          {
            type: "p",
            text: "Below the figures are **Enquiries this week**, **Team activity**, **Content health** and **Content QA**.",
          },
        ],
      },
      {
        title: "Next up",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Next up** lists jobs worth doing now: articles waiting for review, unassigned enquiries, setting up email or media storage, turning on spam protection or two-factor authentication, and background jobs that failed. Each item links to the screen that fixes it.",
          },
          {
            type: "p",
            text: "The bell in the top bar shows the same kind of alerts. A red dot means something needs attention; **You're all caught up** means nothing does.",
          },
        ],
      },
    ],
  },
  {
    slug: "search-and-shortcuts",
    title: "Search and shortcuts",
    group: "start",
    description: "Jump anywhere with ⌘K and save with ⌘S.",
    lead: "Most things in the admin are a few keys away. On Windows and Linux use Ctrl where this page says ⌘.",
    keywords: ["command", "palette", "keyboard", "shortcut", "cmd k"],
    sections: [
      {
        title: "Getting around",
        blocks: [],
      },
      {
        title: "Search with ⌘K",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Press `⌘K` (or select the search box at the top) to open **Search the admin**. Type a few letters to find:",
          },
          {
            type: "list",
            items: [
              "**Go to**: any screen your role can open.",
              "**Records**: pages, services, articles, team members, client logos, group companies, categories and enquiries.",
              "**People**: admin users, for those who manage users.",
              "**Actions**: **New article**, **New page**, **New service**, **Open the live site**, switching the theme, and **Sign out**.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "Inside a rich-text field, `⌘K` adds a link to the selected text instead of opening search.",
          },
        ],
      },
      {
        title: "Keyboard shortcuts",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "`⌘K`: search and go.",
              "`⌘J`: open the AI assistant.",
              "`⌘S`: save the draft now (it does not publish).",
              "`Esc`: close panels and dialogs.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "saving-and-publishing",
    title: "Saving and publishing",
    group: "start",
    description: "Drafts, autosave, preview, Publish and History.",
    lead: "Most screens keep your changes in a draft. Visitors see nothing until you select **Publish**, so you can edit in steps and check the preview first.",
    keywords: ["draft", "publish", "autosave", "history", "revert", "preview"],
    sections: [
      {
        title: "Saving your work",
        blocks: [],
      },
      {
        title: "Drafts and autosave",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Your draft saves itself about a second and a half after you stop typing. The status beside the buttons reads **Saving…**, then **Saved**. Press `⌘S` to save straight away.",
          },
          {
            type: "list",
            items: [
              "**Unsaved changes**: a save is waiting.",
              "**Fix errors to save**: a field is invalid. It is marked in red.",
              "**Conflict**: someone else saved this record while you were editing. **Someone else changed this** offers **Copy mine, then reload**, **Reload their version** or **Overwrite with mine**.",
            ],
          },
          {
            type: "p",
            text: "If you try to leave with changes not yet saved, the admin asks **Leave without saving?** first.",
          },
        ],
      },
      {
        title: "Preview",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Turn on **Live preview** to see the draft beside the form, at desktop, tablet or phone size, or select **Preview** to open it in a new tab. A bar on the site reads **Preview: you are seeing unpublished changes.** Visitors never see it.",
          },
        ],
      },
      {
        title: "Going live",
        blocks: [],
      },
      {
        title: "Publish",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Select **Publish**.",
              "Check the list of changes in **Publish changes?**.",
              "Confirm. The site shows the new version straight away.",
            ],
          },
          {
            type: "p",
            text: "The status pill tells you where a record stands: **Draft** (never published), **Published**, or **Unpublished changes** (the draft differs from the live version).",
          },
          {
            type: "callout",
            tone: "note",
            text: "Some screens save straight to the live site with no draft: team members, client logos, group companies and categories, the SEO tab of a page, canonical URLs and redirects. They say so on screen.",
          },
        ],
      },
      {
        title: "History",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Every publish is kept. Select **History**, pick a version and choose **Restore**. The version is loaded into the draft; the site does not change until you publish it.",
          },
        ],
      },
    ],
  },
  {
    slug: "roles",
    title: "Roles and permissions",
    group: "start",
    description: "What each role can do, and why a screen may be missing.",
    lead: "Each person has one or more roles. A person with several roles can do everything any of them allows. The sidebar, search and these help pages only show what your roles can open.",
    keywords: ["permissions", "access", "owner", "admin", "editor", "author"],
    sections: [
      {
        title: "How roles work",
        blocks: [],
      },
      {
        title: "The roles",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Owner**: everything, including other owners' accounts and custom code.",
              "**Admin**: everything except custom code and owners' accounts.",
              "**Editor**: pages, services, articles (anyone's), jobs, team, client logos, media and SEO. Can change content settings. Appearance is read-only.",
              "**Author**: writes their own articles and submits them for review. Cannot publish. Can upload images.",
              "**Marketer**: SEO, redirects, tracking and the consent banner. Can read pages, services, articles and jobs, and upload images.",
              "**Intake**: answers enquiries (and exports them), job applications and live chat.",
              "**Viewer**: reads content and settings, changes nothing.",
            ],
          },
          {
            type: "p",
            text: "Owners and admins can see the full table of roles in [Users & roles](/admin/users) on the **Roles** tab.",
          },
        ],
      },
      {
        title: "A screen is missing",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "If you need a screen you cannot see, ask an owner to add a role to your account. The owners are listed on the [Help](/admin/help) overview under **Who to contact**.",
          },
        ],
      },
    ],
  },
  {
    slug: "ai-assistant-panel",
    title: "Using the AI assistant",
    group: "start",
    description: "Draft, rewrite and get SEO help with ⌘J.",
    lead: "The AI assistant drafts and rewrites text for the screen you are on. Open it with the **AI assistant** button in the top bar or `⌘J`.",
    permission: { ai: ["use"] },
    keywords: ["ai", "assistant", "write", "rewrite", "claude", "openai"],
    sections: [
      {
        title: "Asking for help",
        blocks: [
          {
            type: "steps",
            items: [
              "Open the screen you want help with, then press `⌘J`.",
              "Ask for a draft, a rewrite or SEO help.",
              "When the assistant fills in a field, check the text, then save or publish as usual. **Undo** puts the old text back.",
            ],
          },
          {
            type: "p",
            text: "The assistant sees the screen you are on. Remove the screen chip (**Don't send this screen**) to leave it out. **New chat** starts again; **Past conversations** opens earlier ones.",
          },
          {
            type: "callout",
            tone: "note",
            text: "An owner or admin chooses the AI provider and who may use it in [AI assistant](/admin/settings/ai-assistant). If the button is missing, ask them.",
          },
        ],
      },
    ],
  },
]
