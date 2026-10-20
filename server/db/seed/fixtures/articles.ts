import "server-only"

import type { Seo } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"

import type { AuthorEmail } from "./authors"
import type { MediaLookup } from "./media"
import { bulletList, doc, heading2, image, paragraph, quote } from "./rich-text"

export type ArticleFixture = {
  slug: string
  categorySlug: string
  authorEmail: AuthorEmail | null
  /** Display date in Europe/Dublin is the date part. */
  publishedAt: Date
  readTimeMinutes: number | null
  content: ArticleContent
  seo: Seo
}

const MICHAEL: AuthorEmail = "michael.mcdonald@authors.invalid"

/** 09:00 UTC (10:00 Irish summer time) on the given day. */
const on = (day: string) => new Date(`${day}T09:00:00Z`)

/** Newest first. The first one is the blog's featured article (pages.blog.featuredArticle). */
export function articlesFixture(media: MediaLookup): ArticleFixture[] {
  return [
    {
      slug: "18-years-of-watching-over-ireland",
      categorySlug: "company-news",
      authorEmail: MICHAEL,
      publishedAt: on("2026-09-20"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "18 Years of Watching Over Ireland",
        excerpt:
          "Since 2008, Security Partners has grown from a family business in Mountmellick into a security team trusted by hotels, retailers and businesses across Ireland. Here's how we got here.",
        cover: media("/images/hero.jpg"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "mobile-patrols-protect-your-business-after-hours",
      categorySlug: "mobile-patrols",
      authorEmail: MICHAEL,
      publishedAt: on("2026-09-12"),
      readTimeMinutes: 5,
      seo: {},
      content: {
        title: "How Mobile Patrols Protect Your Business After Hours",
        excerpt:
          "What a scheduled patrol actually covers, and why visible security deters break-ins.",
        cover: media("/images/hero.jpg"),
        lead: "What a scheduled patrol actually covers, and why a visible security presence deters break-ins.",
        tags: ["Mobile Patrols", "Key Holding", "Business Security"],
        body: doc(
          paragraph(
            "When your business closes for the night, it becomes an easy target. A mobile patrol puts clearly identifiable security officers on your premises at set times, so problems are found early and unwanted activity is deterred."
          ),
          heading2("What a scheduled patrol covers"),
          paragraph(
            "Every patrol is planned around your site and your schedule. Our officers check the areas that matter most to you and report back to our Operations Team as they go."
          ),
          bulletList(
            "Perimeter, doors and windows checked for signs of entry",
            "Lights, alarms and equipment left in a safe state",
            "Tag point checks logged at every stop, in real time",
            "Any issue reported straight to our 24/7 Operations Team"
          ),
          quote(
            "A visible security presence is one of the simplest ways to deter break-ins, vandalism and anti-social behaviour.",
            "Security Partners Operations Team"
          ),
          heading2("Pairing patrols with key holding"),
          paragraph(
            "With key holding, our team holds secure keys to your premises. If your alarm is activated, an officer can be dispatched to deal with the situation, so you are not called out in the middle of the night."
          ),
          image(
            media("/images/about.png"),
            "Security Partners officer completing a patrol report"
          ),
          heading2("Is a mobile patrol right for you?"),
          paragraph(
            "Mobile patrols suit offices, retail units, building sites and any premises left empty after hours. Get in touch and our team will recommend a patrol plan that fits your site."
          )
        ),
      },
    },
    {
      slug: "planning-security-for-your-next-event",
      categorySlug: "event-security",
      authorEmail: null,
      publishedAt: on("2026-08-28"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Planning Security for Your Next Event",
        excerpt:
          "From access control to crowd management: a checklist for organisers of events of any size.",
        cover: media("/images/banner.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "inside-our-24-7-operations-team",
      categorySlug: "company-news",
      authorEmail: null,
      publishedAt: on("2026-08-05"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Inside Our 24/7 Operations Team",
        excerpt:
          "How real-time reporting, clocking and tag point systems keep our clients informed around the clock.",
        cover: media("/images/about.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "key-holding-explained",
      categorySlug: "key-holding",
      authorEmail: null,
      publishedAt: on("2026-07-02"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Key Holding Explained: Who Responds When Your Alarm Goes Off",
        excerpt:
          "What happens after an alarm activation, and why a key holder saves you a call-out.",
        cover: media("/images/about.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "loss-prevention-trained-retail-officers",
      categorySlug: "retail-security",
      authorEmail: null,
      publishedAt: on("2026-06-18"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Loss Prevention: What Trained Retail Officers Do Differently",
        excerpt:
          "How our retail team keeps shops safe for the public while cutting losses.",
        cover: media("/images/hero.jpg"),
        lead: null,
        tags: [],
        body: null,
      },
    },
    {
      slug: "open-up-lock-up-keeps-staff-safe",
      categorySlug: "open-up-lock-up",
      authorEmail: null,
      publishedAt: on("2026-06-04"),
      readTimeMinutes: null,
      seo: {},
      content: {
        title: "Why Open Up & Lock Up Services Keep Your Staff Safe",
        excerpt:
          "A simple, secure way to make sure staff get in and out of work safely.",
        cover: media("/images/banner.png"),
        lead: null,
        tags: [],
        body: null,
      },
    },
  ]
}
