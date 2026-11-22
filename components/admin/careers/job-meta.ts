import type { EditorMeta } from "@/components/admin/schema-form/editor-meta"

/** Editor hints for a job opening (/careers/<slug>). */
export const jobEditorMeta: EditorMeta = {
  fields: {
    title: { label: "Job title" },
    category: {
      label: "Category",
      help: "The chip on /careers and the tag on the job page, e.g. Static Guarding.",
    },
    licence: {
      label: "PSA licence type",
      help: "Used by the licence filter on /careers.",
    },
    location: { label: "Location" },
    employmentType: {
      label: "Job type (shown)",
      help: "As written on the site, e.g. Full-time, Permanent.",
    },
    contractType: {
      label: "Contract (for Google)",
      widget: "radio",
      options: [
        { value: "full-time", label: "Full-time" },
        { value: "part-time", label: "Part-time" },
        { value: "contract", label: "Contract" },
        { value: "temporary", label: "Temporary" },
      ],
    },
    shift: { label: "Hours / shift pattern" },
    pay: { label: "Pay" },
    reference: { label: "Job reference" },
    startDate: { label: "Start date", help: "Free text, e.g. December 2026." },
    closingDate: {
      label: "Closing date",
      placeholder: "YYYY-MM-DD",
      help: "Applications close at the end of this day (Irish time). The role then moves to Previous Openings.",
    },
    urgent: { label: "Urgent", help: "Shows the Urgent tag instead of Open." },
    filled: {
      label: "Position filled",
      help: "Closes the role now, whatever the closing date.",
    },
    summary: {
      label: "Summary",
      widget: "textarea",
      help: "One sentence under the title on the job page.",
    },
    about: { label: "About the role" },
    responsibilities: {
      label: "Key responsibilities",
      itemName: "Responsibility",
    },
    essential: { label: "Essential requirements", itemName: "Requirement" },
    desirable: { label: "Desirable (nice to have)", itemName: "Requirement" },
    offerIntro: {
      label: "What we offer: intro",
      widget: "textarea",
      help: "Leave “What we offer” items empty to hide the section.",
    },
    offers: { label: "What we offer", itemName: "Benefit", itemLabel: "text" },
    "offers[].icon": {
      label: "Icon",
      options: [
        { value: "euro", label: "Euro" },
        { value: "shield", label: "Shield" },
        { value: "shirt", label: "Uniform" },
        { value: "clock", label: "Clock" },
        { value: "wallet", label: "Wallet" },
        { value: "heart", label: "Heart" },
        { value: "graduation", label: "Training" },
        { value: "car", label: "Car" },
        { value: "phone", label: "Phone" },
        { value: "moon", label: "Night" },
      ],
    },
    "offers[].text": { label: "Text" },
  },
  groups: {
    "": [
      {
        title: "Post the job",
        description:
          "The essentials. Fill these in and publish: everything else has a sensible default.",
        fields: [
          "title",
          "location",
          "employmentType",
          "closingDate",
          "summary",
        ],
      },
      {
        title: "Job description",
        description: "What the role involves and who we are looking for.",
        fields: ["about", "responsibilities", "essential"],
      },
      {
        title: "More details (optional)",
        description:
          "Category, licence, pay, hours, benefits and status. Adjust only if they differ from the defaults.",
        fields: [
          "category",
          "licence",
          "contractType",
          "shift",
          "pay",
          "startDate",
          "reference",
          "desirable",
          "offerIntro",
          "offers",
          "urgent",
          "filled",
        ],
      },
    ],
  },
}
