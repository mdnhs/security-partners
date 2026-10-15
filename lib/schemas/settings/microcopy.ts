import { z } from "zod"

import { href, text } from "../common"

/**
 * settings.microcopy — shared labels, aria labels and template strings
 * ({title}, {n}, {category}, {name}, {url} are filled in at render).
 */
export const microcopySettings = z.object({
  header: z.object({ phone24hLabel: text, hoursLabel: text }),
  aria: z.object({
    mainNav: text,
    openMenu: text,
    closeMenu: text,
    mobileNav: text,
    footerNav: text,
    breadcrumb: text,
    serviceCardReadMore: text,
    allServices: text,
    blogFilter: text,
    pagination: text,
    previousPage: text,
    pageNumber: text,
    nextPage: text,
    categories: text,
    shareOn: text,
  }),
  breadcrumb: z.object({
    home: text,
    services: text,
    servicesHref: href,
    blog: text,
    blogHref: href,
  }),
  serviceCard: z.object({ readMore: text }),
  service: z.object({
    overviewEyebrow: text,
    includedHeading: text,
    allServicesHeading: text,
    helpEyebrow: text,
    helpHeading: text,
    telLabel: text,
    orLabel: text,
    phone24hLabel: text,
    ctaLabel: text,
    ctaHref: href,
    otherEyebrow: text,
    otherHeading: text,
    otherIntro: text,
  }),
  blog: z.object({
    allPostsFilter: text,
    readArticle: text,
    featuredBadge: text,
    emptyCategory: text,
  }),
  article: z.object({
    readTime: text,
    relatedEyebrow: text,
    relatedHeading: text,
    tagsLabel: text,
    shareLabel: text,
    recentPostsHeading: text,
    categoriesHeading: text,
    ctaEyebrow: text,
    ctaHeading: text,
    ctaCopy: text,
    ctaLabel: text,
    ctaHref: href,
  }),
  share: z.object({
    networks: z.array(z.object({ label: text, name: text, href })).min(1),
  }),
})
export type MicrocopySettings = z.infer<typeof microcopySettings>
