import type {
  ArticleBodyProps,
  ArticleHeaderProps,
} from "@/components/blog/article"
import type { BlogCardPost } from "@/components/blog/blog-card"
import type { BlogPostsProps } from "@/components/blog/blog-posts"
import type { PageHeroProps } from "@/components/home/page-hero"
import type { EnquireBannerProps } from "@/components/home/services"
import { interpolate } from "@/lib/interpolate"
import type { SiteSources } from "@/templates/shared/sources"
import {
  articleDates,
  authorOf,
  blogCard,
  type ChromeView,
  chromeView,
  enquireBannerView,
  featuredArticle,
  listedArticles,
  pageHeroView,
} from "@/templates/shared/views"

export type BlogView = {
  chrome: ChromeView
  hero: PageHeroProps
  posts: Omit<BlogPostsProps, "initialCategory">
  enquireBanner: EnquireBannerProps
}

export function blogView(s: SiteSources): BlogView {
  const page = s.pages.blog.data
  const { microcopy } = s.settings
  const featured = featuredArticle(s)
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    posts: {
      posts: listedArticles(s).map(blogCard),
      featured: featured
        ? { ...blogCard(featured), author: authorOf(featured) }
        : null,
      filters: s.categories.filter((c) => c.showInFilter).map((c) => c.name),
      pageSize: page.pageSize,
      labels: {
        allPosts: microcopy.blog.allPostsFilter,
        readArticle: microcopy.blog.readArticle,
        featuredBadge: microcopy.blog.featuredBadge,
        emptyCategory: microcopy.blog.emptyCategory,
        filterAria: microcopy.aria.blogFilter,
        paginationAria: microcopy.aria.pagination,
        previousPage: microcopy.aria.previousPage,
        pageNumber: microcopy.aria.pageNumber,
        nextPage: microcopy.aria.nextPage,
      },
    },
    enquireBanner: enquireBannerView(s),
  }
}

export type ArticleView = {
  chrome: ChromeView
  header: ArticleHeaderProps
  body: ArticleBodyProps
  related: {
    eyebrow: string
    heading: string
    posts: BlogCardPost[]
    readArticle: string
  }
}

/** /blog/[slug]; null for an unknown or unpublished slug (→ 404). */
export function articleView(s: SiteSources, slug: string): ArticleView | null {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return null
  const { microcopy } = s.settings
  const { content } = article
  const category = article.category.name
  // The static site's lists never include the featured article.
  const others = listedArticles(s).filter((a) => a.slug !== slug)
  // Same category first, then the most recent posts.
  const related = [
    ...others.filter((a) => a.category.name === category),
    ...others.filter((a) => a.category.name !== category),
  ].slice(0, 3)
  return {
    chrome: chromeView(s),
    header: {
      article: {
        title: content.title,
        lead: content.lead ?? content.excerpt,
        category,
        ...articleDates(article),
        readTime:
          article.readTimeMinutes === null
            ? null
            : interpolate(microcopy.article.readTime, {
                n: article.readTimeMinutes,
              }),
        author: authorOf(article),
        cover: content.cover.url,
      },
      breadcrumb: {
        ariaLabel: microcopy.aria.breadcrumb,
        home: microcopy.breadcrumb.home,
        blog: microcopy.breadcrumb.blog,
        blogHref: microcopy.breadcrumb.blogHref,
      },
    },
    body: {
      body: content.body,
      excerpt: content.excerpt,
      tags: content.tags.length ? content.tags : [category],
      share: {
        title: content.title,
        label: microcopy.article.shareLabel,
        ariaTemplate: microcopy.aria.shareOn,
        networks: microcopy.share.networks,
      },
      recent: others.slice(0, 3).map((a) => ({
        slug: a.slug,
        title: a.content.title,
        cover: a.content.cover.url,
        ...articleDates(a),
      })),
      categories: s.categories
        .filter((c) => c.showInFilter)
        .map((c) => ({
          name: c.name,
          count: s.articles.filter((a) => a.category.slug === c.slug).length,
        })),
      labels: {
        tagsLabel: microcopy.article.tagsLabel,
        recentPostsHeading: microcopy.article.recentPostsHeading,
        categoriesAria: microcopy.aria.categories,
        categoriesHeading: microcopy.article.categoriesHeading,
      },
      cta: {
        eyebrow: microcopy.article.ctaEyebrow,
        heading: microcopy.article.ctaHeading,
        copy: microcopy.article.ctaCopy,
        link: {
          label: microcopy.article.ctaLabel,
          href: microcopy.article.ctaHref,
        },
      },
    },
    related: {
      eyebrow: microcopy.article.relatedEyebrow,
      heading: microcopy.article.relatedHeading,
      posts: related.map(blogCard),
      readArticle: microcopy.blog.readArticle,
    },
  }
}
