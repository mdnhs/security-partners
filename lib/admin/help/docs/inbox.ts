import type { HelpArticle } from "../types"

export const INBOX_DOCS: readonly HelpArticle[] = [
  {
    slug: "enquiries",
    title: "Enquiries",
    group: "inbox",
    description: "Messages from the contact form: follow up, assign, export.",
    lead: "[Enquiries](/admin/leads) lists the messages sent through the contact form. The number beside it in the sidebar counts new enquiries nobody is assigned to.",
    permission: { lead: ["read"] },
    keywords: ["leads", "contact form", "messages", "inbox", "spam"],
    sections: [
      {
        title: "Working an enquiry",
        blocks: [],
      },
      {
        title: "Following up",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Enquiries](/admin/leads) and select an enquiry.",
              "Read the **Contact**, **Message** and **Source** details.",
              "Set the **Lead status** and who it is **Assigned to**. Changes save straight away.",
              "Add **Notes** for the team. They are never sent to the person.",
            ],
          },
          {
            type: "p",
            text: "The statuses are **New**, **Contacted**, **Qualified**, **Won**, **Lost** and **Spam**. On the **Board** view, drag a card to another column or use its **Move to** menu; **Table** shows a list.",
          },
        ],
      },
      {
        title: "Finding an enquiry",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Filter by status and by assignee (**Anyone**, **Me**, **Unassigned** or a person), or search by name, email, company or phone. Messages caught as spam are in the **Spam** folder.",
          },
        ],
      },
      {
        title: "Records and emails",
        blocks: [],
      },
      {
        title: "Export and delete",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Export CSV** downloads what the list shows. Times in the file are in UTC.",
              "Owners and admins can delete an enquiry; its notes and history go with it. This cannot be undone.",
              "Enquiries older than the retention period set in [Enquiries settings](/admin/settings/leads) are deleted automatically.",
            ],
          },
        ],
      },
      {
        title: "Emails",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Each new enquiry is emailed to the addresses in [Enquiries settings](/admin/settings/leads), with reply-to set to the visitor. The visitor's acknowledgement email is sent only when spam protection checked the message. Whether each email was sent is shown in the enquiry's **Activity**.",
          },
        ],
      },
    ],
  },
  {
    slug: "live-chat",
    title: "Live chat",
    group: "inbox",
    description: "Answer visitors in the chat bubble, take over from the AI.",
    lead: "[Live chat](/admin/chat) holds the conversations from the site's chat bubble. The number in the sidebar counts open chats with an unread message.",
    permission: { chat: ["read"] },
    keywords: ["chat", "conversation", "support", "visitor", "bubble"],
    sections: [
      {
        title: "Answering chats",
        blocks: [],
      },
      {
        title: "Replying",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Live chat](/admin/chat) and pick a chat on the **Open** tab.",
              "Type in the reply box. `Enter` sends; `Shift` + `Enter` adds a new line.",
              "Select **Close** when the conversation is over.",
            ],
          },
          {
            type: "p",
            text: "If the AI assistant answers first, the chat reads **AI is replying**. Sending a reply, or **Take over**, puts you in charge; **Hand back to AI** returns it.",
          },
        ],
      },
      {
        title: "Managing chats",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "Chat managers (owners and admins) can **Assign to me**, **Unassign** and **Delete** a chat.",
              "Chats idle for 24 hours close on their own.",
              "If a visitor waits for a reply, an alert email goes to the enquiry recipients.",
              "**Privacy request** downloads or erases every chat held for one email address.",
            ],
          },
        ],
      },
      {
        title: "Turning the chat on",
        blocks: [
          {
            type: "p",
            text: "The chat is off until a chat manager turns on **Show the chat on the site** in [Live chat settings](/admin/settings/chat). The same screen holds the AI assistant options, every text visitors see, and how long chats are kept.",
          },
        ],
      },
    ],
  },
  {
    slug: "job-applications",
    title: "Job applications",
    group: "inbox",
    description: "Review applications, download CVs, track status.",
    lead: "[Job applications](/admin/careers/applications) lists applications sent through the job pages. CVs and answers are private and are deleted after the retention period.",
    permission: { application: ["read"] },
    keywords: ["applications", "applicants", "cv", "candidates", "careers"],
    sections: [
      {
        title: "Handling applications",
        blocks: [],
      },
      {
        title: "Reviewing an application",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Job applications](/admin/careers/applications). Filter by status or role, or search.",
              "Open an application to read each part of the form.",
              "Download the CV or PSA card under **Files**.",
              "Set the **Status** and add an **Internal note**.",
            ],
          },
          {
            type: "p",
            text: "The statuses are **New**, **Reviewing**, **Shortlisted**, **Interview**, **Offered**, **Hired** and **Rejected**. The number in the sidebar counts New applications.",
          },
        ],
      },
      {
        title: "Notifications and retention",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Who is emailed about new applications, and how long applications are kept, is set in [Careers settings](/admin/settings/careers). The email never carries the CV; it stays in the admin.",
          },
        ],
      },
    ],
  },
]
