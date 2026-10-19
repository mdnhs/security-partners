import type { BlockInstance } from "@/blocks/registry"
import type { StatsProps } from "@/components/about/stats"
import type { DepartmentsProps } from "@/components/contact/departments"
import type { AboutProps } from "@/components/home/about"
import type {
  BlogProps,
  ClientsProps,
  TeamProps,
} from "@/components/home/clients-team-blog"
import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { IconCardsProps } from "@/components/home/icon-cards"
import type { PageHeroProps } from "@/components/home/page-hero"
import type {
  EnquireBannerProps,
  ServicesProps,
} from "@/components/home/services"
import type { WhyChooseUsProps } from "@/components/services/why-choose-us"
import { interpolate, interpolateHref } from "@/lib/interpolate"
import type { WithMedia } from "@/lib/media"
import type { RichTextDoc } from "@/lib/schemas/common"
import type { SiteSources } from "@/templates/shared/sources"
import {
  aboutSectionView,
  blogCard,
  clientsView,
  contactSectionView,
  enquireBannerView,
  linkView,
  listedArticles,
  locationMapView,
  pageHeroView,
  placeholders,
  serviceCard,
  serviceCardLabels,
  teamView,
} from "@/templates/shared/views"

// Block instance → props of the existing public component (spec §7.5). Pure
// functions of SiteSources, like every other template view: blocks wrap the
// public sections, they never change them.

/** A block with every `{ mediaId }` resolved (server/modules/media resolveMedia). */
export type ResolvedBlock = WithMedia<BlockInstance>

type Of<T extends ResolvedBlock["type"]> = Extract<ResolvedBlock, { type: T }>

export type BlockViewResult =
  | { type: "hero.page"; props: PageHeroProps }
  | { type: "about"; props: AboutProps }
  | { type: "stats"; props: StatsProps }
  | { type: "iconCards"; props: IconCardsProps }
  | { type: "services"; props: ServicesProps }
  | { type: "whyChooseUs"; props: WhyChooseUsProps }
  | { type: "enquireBanner"; props: EnquireBannerProps }
  | { type: "clients"; props: ClientsProps }
  | { type: "team"; props: TeamProps }
  | { type: "blog"; props: BlogProps }
  | { type: "departments"; props: DepartmentsProps }
  | { type: "contact"; props: ContactProps }
  | { type: "map"; props: LocationMapProps }
  | { type: "richtext"; props: { doc: WithMedia<RichTextDoc> } }
  /** Rendered by the D4 sign-up form when its copy is available. */
  | { type: "newsletter"; props: null }

/** The shared Why choose us section (as on /services). */
function whyChooseUsView(s: SiteSources): WhyChooseUsProps {
  const why = s.settings["sections.whyChooseUs"]
  return {
    eyebrow: why.eyebrow,
    heading: why.heading,
    copy: why.copy,
    features: why.features.map((f) => ({
      title: f.title,
      description: f.description,
      icon: f.icon.url,
    })),
  }
}

function departmentsView(
  s: SiteSources,
  data: Of<"departments">["data"]
): DepartmentsProps {
  const values = placeholders(s)
  return {
    eyebrow: data.eyebrow,
    heading: data.heading,
    intro: data.intro,
    items: data.items.map((item) => ({
      title: item.title,
      icon: item.icon.url,
      name: item.name,
      role: item.role,
      lines: item.lines.map((line) => ({
        text: interpolate(line.text, values),
        href: interpolateHref(line.href, values),
      })),
    })),
  }
}

export function blockView(
  block: ResolvedBlock,
  s: SiteSources
): BlockViewResult {
  switch (block.type) {
    case "hero.page":
      return { type: block.type, props: pageHeroView(s, block.data) }
    case "about":
      return { type: block.type, props: aboutSectionView(s) }
    case "stats":
      return { type: block.type, props: { stats: block.data.items } }
    case "iconCards":
      return {
        type: block.type,
        props: {
          eyebrow: block.data.eyebrow,
          title: block.data.title,
          description: block.data.description,
          items: block.data.items.map((item) => ({
            title: item.title,
            description: item.description,
            icon: item.icon.url,
          })),
        },
      }
    case "services":
      return {
        type: block.type,
        props: {
          eyebrow: block.data.eyebrow,
          title: block.data.heading,
          description: block.data.intro,
          services: s.services.slice(0, block.data.count).map(serviceCard),
          labels: serviceCardLabels(s),
        },
      }
    case "whyChooseUs":
      return { type: block.type, props: whyChooseUsView(s) }
    case "enquireBanner":
      return { type: block.type, props: enquireBannerView(s) }
    case "clients":
      return { type: block.type, props: clientsView(s) }
    case "team": {
      // The block has no eyebrow of its own: the home page's team eyebrow.
      const { eyebrow } = s.pages.home.data.team
      return {
        type: block.type,
        props: teamView(s, {
          eyebrow,
          heading: block.data.heading,
          intro: block.data.intro,
        }),
      }
    }
    case "blog": {
      // Eyebrow and "all posts" link as on the home page's blog section.
      const home = s.pages.home.data.blog
      return {
        type: block.type,
        props: {
          eyebrow: home.eyebrow,
          heading: block.data.heading,
          intro: block.data.intro,
          cta: linkView(s, home.cta),
          posts: listedArticles(s)
            .slice(0, block.data.count)
            .map((a) => blogCard(s, a)),
          readArticle: s.settings.microcopy.blog.readArticle,
        },
      }
    }
    case "departments":
      return { type: block.type, props: departmentsView(s, block.data) }
    case "contact":
      return { type: block.type, props: contactSectionView(s) }
    case "map":
      return { type: block.type, props: locationMapView(s) }
    case "richtext":
      return { type: block.type, props: { doc: block.data.doc } }
    case "newsletter":
      return { type: block.type, props: null }
  }
}

export type BuilderBlockView = { block: ResolvedBlock; view: BlockViewResult }

/** Views of the visible blocks, in document order (hidden blocks never render). */
export function builderBlocksView(
  blocks: readonly ResolvedBlock[],
  s: SiteSources
): BuilderBlockView[] {
  return blocks
    .filter((block) => !block.hidden)
    .map((block) => ({ block, view: blockView(block, s) }))
}

/** A hero's description, the page's fallback meta description. */
export function firstHeroDescription(
  blocks: readonly BlockInstance[]
): string | null {
  const [first] = blocks
  return first?.type === "hero.page" ? first.data.description : null
}
