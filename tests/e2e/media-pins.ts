import type { Page } from "@playwright/test"

// The media library, pinned for screenshots and the axe gate (Phase 6):
// fixed names, sizes and dates; thumbnails are real files from public/
// (served through the default next/image optimizer like any upload).

const STAMP = {
  createdAt: "2026-10-14T09:30:00.000Z",
  updatedAt: "2026-10-14T09:30:00.000Z",
}

type PinnedMedia = {
  id: string
  url: string
  alt: string
  mime: string
  width: number | null
  height: number | null
  size: number
  createdAt: string
  updatedAt: string
  originalName: string
  driver: "static" | "disk" | "r2"
  focalX: number | null
  focalY: number | null
  isDecorative: boolean
  caption: string
  createdBy: string | null
}

const media = (
  n: number,
  fields: Omit<
    PinnedMedia,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "focalX"
    | "focalY"
    | "isDecorative"
    | "caption"
    | "createdBy"
  > &
    Partial<PinnedMedia>
): PinnedMedia => ({
  id: `0190f0e0-0000-7000-8000-0000000000c${n}`,
  focalX: null,
  focalY: null,
  isDecorative: false,
  caption: "",
  createdBy: null,
  ...STAMP,
  ...fields,
})

export const MEDIA_ITEMS: PinnedMedia[] = [
  media(1, {
    url: "/images/hero.jpg",
    alt: "A patrol car outside a business park at dusk",
    mime: "image/jpeg",
    width: 1440,
    height: 748,
    size: 93_265,
    originalName: "patrol-car-hero.jpg",
    driver: "disk",
    focalX: 0.62,
    focalY: 0.4,
  }),
  media(2, {
    url: "/images/service-patrols.png",
    alt: "Mobile patrols",
    mime: "image/png",
    width: 311,
    height: 312,
    size: 22_458,
    originalName: "mobile-patrols.png",
    driver: "disk",
  }),
  media(3, {
    url: "/images/team-temp.jpg",
    alt: "",
    mime: "image/jpeg",
    width: 508,
    height: 639,
    size: 42_779,
    originalName: "night-supervisor.jpg",
    driver: "r2",
  }),
  media(4, {
    url: "/images/about.png",
    alt: "Guards briefing before a shift",
    mime: "image/png",
    width: 720,
    height: 1047,
    size: 809_572,
    originalName: "about.png",
    driver: "static",
  }),
  media(5, {
    url: "/files/price-list-2026.pdf",
    alt: "",
    mime: "application/pdf",
    width: null,
    height: null,
    size: 1_288_490,
    originalName: "price-list-2026.pdf",
    driver: "disk",
  }),
  media(6, {
    url: "/images/banner.png",
    alt: "Control room banner",
    mime: "image/png",
    width: 1280,
    height: 367,
    size: 289_764,
    originalName: "control-room-banner.png",
    driver: "disk",
  }),
  media(7, {
    url: "/images/icon-shield.svg",
    alt: "",
    mime: "image/svg+xml",
    width: 24,
    height: 24,
    size: 479,
    originalName: "icon-shield.svg",
    driver: "static",
  }),
  media(8, {
    url: "/images/service-alarm.png",
    alt: "Alarm response",
    mime: "image/png",
    width: 311,
    height: 312,
    size: 26_058,
    originalName: "alarm-response.png",
    driver: "disk",
  }),
]

/** Where the hero photo is used: refuses its delete (409). */
export const HERO_USAGES = [
  {
    entityType: "page",
    entityId: "home",
    field: "hero.backgroundImage",
    label: "Home page",
    href: "/admin/pages/home",
  },
  {
    entityType: "service",
    entityId: "0190f0e0-0000-7000-8000-0000000000d1",
    field: "image",
    label: "Mobile Patrols",
    href: "/admin/services/0190f0e0-0000-7000-8000-0000000000d1",
  },
]

const isImage = (m: PinnedMedia) => m.mime.startsWith("image/")

/**
 * Serves the pinned library from /api/v1/admin/media (list filtered by
 * kind and q like the API, items, usages, a 409 on delete). Ids not in the
 * pinned set go to the real API (e.g. the page editor's own hero image).
 */
export async function pinMedia(page: Page) {
  const byId = new Map(MEDIA_ITEMS.map((m) => [m.id, m]))
  await page.route(
    (url) => url.pathname.startsWith("/api/v1/admin/media"),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const rest = url.pathname.slice("/api/v1/admin/media".length)
      if (rest === "" || rest === "/") {
        if (request.method() !== "GET") return route.continue()
        const kind = url.searchParams.get("kind")
        const q = (url.searchParams.get("q") ?? "").toLowerCase()
        const items = MEDIA_ITEMS.filter(
          (m) =>
            (kind === "image"
              ? isImage(m)
              : kind === "document"
                ? !isImage(m)
                : true) &&
            (!q || `${m.alt} ${m.originalName}`.toLowerCase().includes(q))
        )
        return route.fulfill({
          json: { items, page: 1, pageSize: 24, total: items.length },
        })
      }
      const [, id, sub] = rest.split("/")
      const item = id ? byId.get(id) : undefined
      if (!item) return route.continue()
      if (sub === "usages")
        return route.fulfill({
          json: { items: item.id === MEDIA_ITEMS[0]!.id ? HERO_USAGES : [] },
        })
      if (request.method() === "DELETE")
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: "CONFLICT",
              message: `This file is used in ${HERO_USAGES.length} places. Choose another file there first.`,
              current: { usages: HERO_USAGES },
              requestId: "pinned",
            },
          },
        })
      if (request.method() !== "GET") return route.abort()
      return route.fulfill({ json: item })
    }
  )
}

/**
 * Uploads frozen mid-way (installed before the page loads): XHR uploads
 * report 40 % and never finish, except a file whose name contains "fail",
 * which gets the server's 422 for an unsupported type. The app's other
 * requests use fetch, untouched.
 */
export async function freezeUploads(page: Page) {
  await page.addInitScript(() => {
    class FrozenUpload {
      status = 0
      response: unknown = null
      responseType = ""
      upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
        onprogress: null,
      }
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onabort: (() => void) | null = null
      open() {}
      abort() {
        this.onabort?.()
      }
      send(body: FormData) {
        const file = body.get("file") as File | null
        setTimeout(() => {
          if (file?.name.includes("fail")) {
            this.status = 422
            this.response = {
              error: {
                code: "VALIDATION_FAILED",
                message: "Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file",
                fieldErrors: {
                  file: ["Upload a JPEG, PNG, WebP, AVIF, SVG or PDF file"],
                },
                requestId: "pinned",
              },
            }
            this.onload?.()
          } else
            this.upload.onprogress?.({
              lengthComputable: true,
              loaded: 40,
              total: 100,
            } as ProgressEvent)
        }, 0)
      }
    }
    Object.defineProperty(window, "XMLHttpRequest", { value: FrozenUpload })
  })
}

/** The images shown in the viewport have loaded (screenshots wait for it). */
export function visibleImagesLoaded(page: Page) {
  return page.evaluate(() =>
    [...document.images]
      .filter((img) => {
        const r = img.getBoundingClientRect()
        return (
          r.width > 0 &&
          r.bottom > 0 &&
          r.top < window.innerHeight &&
          getComputedStyle(img).visibility !== "hidden"
        )
      })
      .every((img) => img.complete && img.naturalWidth > 0)
  )
}

/** A tiny real PNG for setInputFiles (frozen uploads never read it). */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)
