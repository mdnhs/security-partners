import type { HelpArticle } from "../types"

export const TEAM_DOCS: readonly HelpArticle[] = [
  {
    slug: "users",
    title: "Users & roles",
    group: "team",
    description: "Invite people, change roles, block access, view as a user.",
    lead: "[Users & roles](/admin/users) lists everyone with an admin account. Owners and admins manage it.",
    permission: { user: ["read"] },
    keywords: ["invite", "people", "team", "ban", "impersonate", "view as"],
    sections: [
      {
        title: "Managing people",
        blocks: [],
      },
      {
        title: "Invite someone",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Select **Invite user**.",
              "Enter their **Email**, **Name** and, if you like, **Job title**.",
              "Choose their roles. See [Roles and permissions](/admin/help/roles).",
              "Send. The invitation link works for 7 days.",
            ],
          },
        ],
      },
      {
        title: "Change a person's access",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Roles**: change what they can do.",
              "**Access**: ban them, until unbanned or for a number of days.",
              "**Password**: send an invitation or a reset link.",
              "**Sessions**: sign them out everywhere.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "Only an owner can change an owner's account or make someone an owner. The last active owner cannot be demoted or banned.",
          },
        ],
      },
      {
        title: "View as",
        blocks: [
          {
            type: "p",
            text: "**View as** on a person's page shows the admin exactly as they see it, for up to one hour. Changes you make are recorded as that person, with you as the one viewing. A banner at the top says whose view it is; **Stop impersonating** ends it.",
          },
        ],
      },
    ],
  },
  {
    slug: "activity-log",
    title: "Activity log",
    group: "team",
    description: "Who changed what, and when.",
    lead: "The [Activity log](/admin/activity) records sign-ins, changes to users, enquiries, applications, content and settings. Times are Irish time.",
    permission: { audit: ["read"] },
    keywords: ["audit", "history", "who changed", "log"],
    sections: [
      {
        title: "Finding an entry",
        blocks: [
          {
            type: "p",
            text: "Filter by **Who**, **Action**, **Record type**, and a **From** and **To** date. **Clear filters** shows everything again. Open an entry to see its details.",
          },
        ],
      },
    ],
  },
  {
    slug: "account",
    title: "Your account",
    group: "team",
    description: "Your name, password, two-factor and signed-in devices.",
    lead: "[Account](/admin/account) is your own profile. Open it from the user menu or with `⌘K`.",
    keywords: [
      "profile",
      "password",
      "two-factor",
      "2fa",
      "devices",
      "sessions",
    ],
    sections: [
      {
        title: "Your account tabs",
        blocks: [],
      },
      {
        title: "Profile",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Change your name and job title, and choose the light, dark or system theme. Your email is shown but cannot be changed.",
          },
        ],
      },
      {
        title: "Security",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Change your password (your other devices are signed out), and turn two-factor authentication on or off. See [Getting started](/admin/help/getting-started#two-factor-authentication).",
          },
        ],
      },
      {
        title: "Devices",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Signed-in devices** lists where you are signed in. **Sign out** ends one; **Sign out all other devices** ends the rest. Sessions last 7 days and are extended while you use them.",
          },
        ],
      },
    ],
  },
]
