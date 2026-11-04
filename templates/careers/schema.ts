import { z } from "zod"

import { iconCard, link, pageHero, text } from "@/lib/schemas/common"

/** A copy string that may be left empty (placeholders, optional hints). */
const optionalText = z.string().max(5000)

const heading = z.object({ eyebrow: text, title: text, description: text })

/** Label and placeholder of one application form field. */
const field = z.object({ label: text, placeholder: optionalText })

/** One option list of the form (radio or checkbox cards, selects). */
const options = z.array(text).min(1).max(20)

/**
 * Page "careers" (/careers) plus the copy the job pages (/careers/<slug>)
 * and the application form (/careers/<slug>/apply) share. Jobs come from the
 * jobs entity; everything worded here is the owner's to change.
 */
export const careersTemplate = z.object({
  hero: pageHero,
  whyJoin: heading.extend({ cards: z.array(iconCard).min(1).max(8) }),
  openings: heading.extend({
    /** "{count} open roles" */
    countLabel: text,
    searchPlaceholder: text,
    allLocations: text,
    allLicenceTypes: text,
    /** "All Roles ({count})" */
    allRoles: text,
    viewJobLabel: text,
    /** "Posted {ago}" */
    postedLabel: text,
    emptyTitle: text,
    emptyText: text,
  }),
  previous: heading.extend({
    /** "Closed on {date}" */
    closedOnLabel: text,
    filledLabel: text,
  }),
  process: heading.extend({
    steps: z
      .array(z.object({ title: text, description: text }))
      .min(1)
      .max(6),
  }),
  cta: z.object({
    eyebrow: text,
    heading: text,
    copy: text,
    primary: link,
    secondary: link,
  }),
  tags: z.object({
    open: text,
    urgent: text,
    nowHiring: text,
    closed: text,
  }),
  job: z.object({
    applyLabel: text,
    shareLabel: text,
    copiedLabel: text,
    aboutHeading: text,
    responsibilitiesHeading: text,
    lookingForHeading: text,
    essentialLabel: text,
    essentialTag: text,
    desirableLabel: text,
    desirableTag: text,
    offerHeading: text,
    equalOpportunity: text,
    closedNotice: text,
    summary: z.object({
      heading: text,
      reference: text,
      location: text,
      jobType: text,
      hours: text,
      pay: text,
      startDate: text,
      closingDate: text,
      applyLabel: text,
      shareLabel: text,
    }),
    questions: z.object({
      heading: text,
      copy: text,
      phone: text,
      phoneHref: text,
      email: text,
    }),
    beforeYouApply: z.object({
      heading: text,
      intro: text,
      items: z.array(text).min(1).max(10),
    }),
    similar: z.object({
      eyebrow: text,
      heading: text,
      viewAllLabel: text,
      viewJobLabel: text,
    }),
  }),
  apply: z.object({
    heroTitle: text,
    crumb: text,
    /** "Ref {reference}" */
    referenceLabel: text,
    backLabel: text,
    title: text,
    intro: text,
    sections: z
      .array(z.object({ title: text, subtitle: optionalText }))
      .length(7),
    fields: z.object({
      firstName: field,
      surname: field,
      email: field,
      phone: field,
      address: field,
      town: field,
      eircode: field,
      rightToWork: field,
      permissionExpiry: field,
      psaHeld: field,
      psaNumber: field,
      psaCategory: field,
      psaExpiry: field,
      psaCard: field,
      qualifications: field,
      employer: field,
      role: field,
      from: field,
      to: field,
      reason: field,
      gardaVetting: field,
      livedAbroad: field,
      experience: field,
      startDate: field,
      shifts: field,
      transport: field,
      cv: field,
      coverNote: field,
      heardFrom: field,
    }),
    options: z.object({
      rightToWork: options,
      psaHeld: options.length(3),
      psaCategory: options,
      qualifications: options,
      experience: options,
      shifts: options,
      heardFrom: options,
      yes: text,
      no: text,
    }),
    hints: z.object({
      rightToWork: text,
      history: text,
      /** "Period {n}" */
      period: text,
      mostRecent: text,
      addPeriod: text,
      removePeriod: text,
      livedAbroad: text,
      psaCardTypes: text,
      cvDrop: text,
      cvBrowse: text,
      cvTypes: text,
      fileTooLarge: text,
      fileWrongType: text,
      required: text,
    }),
    /** Three statements: two required, the third (talent pool) optional. */
    consents: z.array(text).length(3),
    equalOpportunity: text,
    submitLabel: text,
    sendingLabel: text,
    secureNote: text,
    successTitle: text,
    successText: text,
    closedNotice: text,
    sidebar: z.object({
      applyingFor: text,
      viewJob: text,
      nextHeading: text,
      nextSteps: z
        .array(z.object({ title: text, description: text }))
        .min(1)
        .max(6),
      dataHeading: text,
      dataCopy: text,
      helpHeading: text,
    }),
  }),
})
export type CareersTemplate = z.infer<typeof careersTemplate>
