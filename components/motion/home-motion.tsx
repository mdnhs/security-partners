"use client"

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import { useGSAP } from "@gsap/react"

import { pageStory } from "@/components/motion/page-story"

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

// Play on the way down, rewind when scrolling back above the trigger.
const REPLAY = "play none none reverse"

const q = <T extends Element = HTMLElement>(
  selector: string,
  scope?: Element
) => gsap.utils.toArray<T>(selector, scope)

// Wires the home page's data-* hooks to GSAP. Renders nothing; markup stays server-rendered.
export function HomeMotion() {
  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set("[data-hero-item], [data-hero-title]", { autoAlpha: 1 })
    })

    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 1024px)",
      },
      (context) => {
        const { motion, desktop } = context.conditions as {
          motion: boolean
          desktop: boolean
        }
        if (!motion) return

        heroIntro()
        heroScroll()
        scrollProgress()
        reveals()
        aboutStory(desktop)
        parallax()
        banner(desktop)
        const stopStory = pageStory(desktop)
        contactInfo()
        map()
        const stopButtons = bannerButtons()
        const stopCards = serviceCards()
        return () => {
          stopButtons?.()
          stopCards?.()
          stopStory?.()
        }
      }
    )
  })

  return null
}

function heroIntro() {
  const title = document.querySelector<HTMLElement>("[data-hero-title]")
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

  tl.from(
    "[data-hero-media]",
    { scale: 1.18, duration: 2.4, ease: "power2.out" },
    0
  )

  if (title) {
    gsap.set(title, { autoAlpha: 1 })
    SplitText.create(title, {
      type: "words",
      mask: "words",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.words, {
          yPercent: 110,
          duration: 1.1,
          stagger: 0.08,
          ease: "expo.out",
          delay: 0.25,
        }),
    })
  }

  tl.fromTo(
    "[data-hero-item]",
    { autoAlpha: 0, y: 28 },
    { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09 },
    0.45
  )

  for (const el of q("[data-count]")) {
    const target = Number(el.dataset.count)
    const suffix = el.dataset.suffix ?? ""
    const counter = { value: 0 }
    tl.to(
      counter,
      {
        value: target,
        duration: 1.6,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = `${Math.round(counter.value)}${suffix}`
        },
      },
      0.9
    )
  }
}

function heroScroll() {
  const scrub = {
    trigger: "[data-hero]",
    start: "top top",
    end: "bottom top",
    scrub: true,
  }
  gsap.to("[data-hero-media]", {
    yPercent: 18,
    ease: "none",
    scrollTrigger: scrub,
  })
  gsap.to("[data-hero-content]", {
    y: -90,
    autoAlpha: 0.15,
    ease: "none",
    scrollTrigger: { ...scrub, start: "20% top" },
  })
}

function scrollProgress() {
  gsap.to("[data-scroll-progress]", {
    scaleX: 1,
    ease: "none",
    scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
  })
}

function reveals() {
  for (const group of q("[data-stagger]")) {
    // The footer tells its own story (page-story.ts footerStory).
    if (group.closest("footer")) continue
    // Card lists tell their own story (page-story.ts cardStory).
    if (
      group.querySelector(
        ":scope > [data-card='light'], :scope > [data-service-card]"
      )
    )
      continue
    gsap.from(group.children, {
      autoAlpha: 0,
      y: 40,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.1,
      scrollTrigger: {
        trigger: group,
        start: "top 85%",
        toggleActions: REPLAY,
      },
    })
  }

  // Not every page has reveal targets; GSAP warns on an empty selector.
  if (q("[data-reveal]").length > 0) {
    gsap.set("[data-reveal]", { autoAlpha: 0, y: 48 })
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 85%",
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.15,
          overwrite: true,
        }),
      onLeaveBack: (batch) =>
        gsap.to(batch, {
          autoAlpha: 0,
          y: 48,
          duration: 0.6,
          ease: "power2.in",
          overwrite: true,
        }),
    })
  }

  for (const icon of q("[data-service-icon]")) {
    gsap.from(icon, {
      scale: 0.6,
      rotate: -12,
      duration: 0.9,
      ease: "back.out(2)",
      scrollTrigger: { trigger: icon, start: "top 88%", toggleActions: REPLAY },
    })
  }
}

// Scrollytelling: the contact text lights up word by word as you scroll through the list.
function contactInfo() {
  const list = document.querySelector("[data-contact-info]")
  if (!list) return
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: list,
      // Done before the list reaches the middle of the screen, so a centred list is fully shown.
      start: "top 85%",
      end: "center 65%",
      scrub: 0.5,
    },
  })
  q("li", list).forEach((item, i) => {
    const icon = item.firstElementChild
    const text = item.lastElementChild
    const words = q("p, a", text ?? item).flatMap(
      (el) => SplitText.create(el, { type: "words" }).words
    )
    tl.from(icon, { scale: 0.5, duration: 1, ease: "back.out(2)" }, i * 1.2)
    tl.from(
      words,
      { opacity: 0.15, yPercent: 40, stagger: 0.08, duration: 0.6 },
      i * 1.2 + 0.2
    )
  })
}

// Scrollytelling: the About story builds as you scroll through it.
function aboutStory(desktop: boolean) {
  const section = document.querySelector("[data-about]")
  if (!section) return

  gsap
    .timeline({
      scrollTrigger: {
        trigger: section,
        start: "top 75%",
        toggleActions: REPLAY,
      },
      defaults: { ease: "power3.out" },
    })
    .from("[data-about-card]", {
      autoAlpha: 0,
      x: desktop ? -60 : 0,
      y: desktop ? 0 : 40,
      duration: 1.1,
    })
    .from(
      "[data-about-copy]",
      { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.12 },
      "-=0.7"
    )
    .fromTo(
      "[data-about-media]",
      { clipPath: "inset(12% 12% 12% 12% round 28px)" },
      {
        clipPath: "inset(0% 0% 0% 0% round 28px)",
        duration: 1.4,
        ease: "expo.out",
      },
      0.2
    )
    .from(
      "[data-about-badge]",
      { autoAlpha: 0, y: 30, scale: 0.9, duration: 0.8, ease: "back.out(1.8)" },
      "-=0.6"
    )

  // Each highlight lights up as it crosses the reading line, then stays lit.
  for (const item of q("[data-highlight]")) {
    gsap.fromTo(
      item,
      { autoAlpha: 0.25, x: -16 },
      {
        autoAlpha: 1,
        x: 0,
        ease: "none",
        scrollTrigger: {
          trigger: item,
          start: "top 85%",
          end: "top 60%",
          scrub: 0.5,
        },
      }
    )
    const check = item.querySelector("img")
    if (check) {
      gsap.from(check, {
        scale: 0,
        rotate: -90,
        duration: 0.6,
        ease: "back.out(2.4)",
        scrollTrigger: {
          trigger: item,
          start: "top 72%",
          toggleActions: "play none none reverse",
        },
      })
    }
  }
}

function parallax() {
  for (const el of q("[data-parallax]")) {
    gsap.fromTo(
      el,
      { yPercent: -6 },
      {
        yPercent: 6,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    )
  }
}

// Scrollytelling: the enquire banner starts as a small window onto its photo
// and opens to full size as you scroll. On desktop the section becomes a
// two-screen track with a sticky stage (native sticky, no JS pin, so there is
// no jump when it engages): the first screen the window rises from the bottom
// edge and grows, the second it stays put and opens while the photo pulls back
// from a close-up, the blue wash lifts and the copy rises. Both halves are one
// timeline, so the hand-over at the middle is seamless. Phones skip the sticky
// stage and play the story over a short scroll.
function banner(desktop: boolean) {
  const card = document.querySelector<HTMLElement>("[data-banner]")
  if (!card) return
  const section = card.closest<HTMLElement>("section") ?? card
  const stage = card.closest<HTMLElement>("[data-banner-stage]")
  const photo = card.querySelector("[data-parallax]")
  const wash = card.querySelector("[data-banner-overlay]")
  const items = q("[data-banner-item], [data-banner-lines]", card)
  const eyebrow = card.querySelector<HTMLElement>("[data-banner-eyebrow]")
  const sticky = desktop && stage !== null

  if (sticky) {
    // The section's own padding moves onto the stage so the track is exactly
    // two screens: one to arrive, one to open.
    const own = getComputedStyle(section)
    gsap.set(stage, {
      position: "sticky",
      top: 0,
      height: "100vh",
      display: "flex",
      alignItems: "center",
      paddingLeft: own.paddingLeft,
      paddingRight: own.paddingRight,
    })
    gsap.set(section, {
      height: "200vh",
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    })
  }

  const story = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: sticky
      ? {
          trigger: section,
          start: "top bottom",
          end: "bottom bottom",
          scrub: 1,
        }
      : { trigger: card, start: "top 90%", end: "center 50%", scrub: 0.6 },
  })
  const open = sticky ? 1 : 0

  if (sticky) {
    story.fromTo(
      card,
      { clipPath: "inset(41% 46% 41% 46% round 90px)" },
      { clipPath: "inset(26% 36% 26% 36% round 80px)", duration: 1 },
      0
    )
    if (photo)
      story.fromTo(photo, { scale: 1.75 }, { scale: 1.45, duration: 1 }, 0)
  }
  story.fromTo(
    card,
    { clipPath: "inset(26% 36% 26% 36% round 80px)" },
    {
      clipPath: "inset(0% 0% 0% 0% round 32px)",
      duration: 1,
      immediateRender: !sticky,
    },
    open
  )
  if (photo)
    story.fromTo(
      photo,
      { scale: 1.45 },
      { scale: 1, duration: 1, immediateRender: !sticky },
      open
    )
  if (wash)
    story.fromTo(wash, { opacity: 1 }, { opacity: 0.85, duration: 1 }, open)
  // While the window is small, the eyebrow alone sits in its middle, then
  // travels up to its place as the card opens.
  if (eyebrow)
    story.fromTo(
      eyebrow,
      {
        // Layout offsets ignore transforms, so a refresh never measures the
        // already-shifted label.
        y: () =>
          card.offsetHeight / 2 -
          (eyebrow.offsetTop + eyebrow.offsetHeight / 2),
      },
      {
        y: 0,
        duration: 0.7,
        ease: "power2.inOut",
        immediateRender: true,
        invalidateOnRefresh: true,
      },
      open
    )
  story.from(
    items,
    { autoAlpha: 0, y: 28, stagger: 0.1, duration: 0.4, ease: "power2.out" },
    open + 0.4
  )
  bannerPolish(section)
}

function map() {
  const mapEl = document.querySelector("[data-map]")
  if (!mapEl) return

  gsap.fromTo(
    "[data-map-tiles]",
    { scale: 1.12 },
    {
      scale: 1,
      ease: "none",
      scrollTrigger: {
        trigger: mapEl,
        start: "top bottom",
        end: "center center",
        scrub: true,
      },
    }
  )
  gsap
    .timeline({
      scrollTrigger: {
        trigger: mapEl,
        start: "top 65%",
        toggleActions: REPLAY,
      },
    })
    .from("[data-map-pin]", {
      y: -140,
      autoAlpha: 0,
      duration: 1,
      ease: "bounce.out",
    })
    .from(
      "[data-map-label]",
      { autoAlpha: 0, y: 16, scale: 0.85, duration: 0.6, ease: "back.out(2)" },
      "-=0.3"
    )
}

// Service cards follow the pointer: a small 3D tilt, a
// glow that swells out of the bottom-right corner and an icon that drifts the
// other way. Mouse-like pointers only; touch has no hover.
function serviceCards() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
  const stops: (() => void)[] = []

  for (const card of q("[data-service-card]")) {
    const icon = card.querySelector<HTMLElement>("[data-service-icon]")
    const quick = (target: Element, prop: string) =>
      gsap.quickTo(target, prop, { duration: 0.6, ease: "power3.out" })
    const rotateX = quick(card, "rotationX")
    const rotateY = quick(card, "rotationY")
    const iconX = icon && quick(icon, "x")
    const iconY = icon && quick(icon, "y")
    const glow = card.querySelector<HTMLElement>("[data-service-glow]")
    if (glow) gsap.set(glow, { transformOrigin: "100% 100%" })
    gsap.set(card, { transformPerspective: 900 })

    const move = (event: PointerEvent) => {
      const box = card.getBoundingClientRect()
      const px = (event.clientX - box.left) / box.width
      const py = (event.clientY - box.top) / box.height
      rotateY((px - 0.5) * 8)
      rotateX((0.5 - py) * 8)
      iconX?.((px - 0.5) * -16)
      iconY?.((py - 0.5) * -16)
    }
    const enter = () => {
      // The glow swells out of the bottom-right corner.
      if (glow)
        gsap.fromTo(
          glow,
          { scale: 0.5 },
          { scale: 1, duration: 0.9, ease: "power3.out", overwrite: true }
        )
      if (icon)
        gsap.to(icon, { rotate: -6, duration: 0.5, ease: "back.out(3)" })
    }
    const leave = () => {
      if (glow)
        gsap.to(glow, { scale: 0.5, duration: 0.5, ease: "power3.inOut" })
      rotateX(0)
      rotateY(0)
      iconX?.(0)
      iconY?.(0)
      if (icon) gsap.to(icon, { rotate: 0, duration: 0.5, ease: "power3.out" })
    }

    card.addEventListener("pointermove", move as EventListener)
    card.addEventListener("pointerenter", enter)
    card.addEventListener("pointerleave", leave)
    stops.push(() => {
      card.removeEventListener("pointermove", move as EventListener)
      card.removeEventListener("pointerenter", enter)
      card.removeEventListener("pointerleave", leave)
    })
  }

  return () => stops.forEach((stop) => stop())
}

// Enquire banner: the heading and copy rise line by line, the photo settles
// from a slow zoom and the blue wash lifts as the banner scrolls into view.
function bannerPolish(section: Element) {
  for (const el of q<HTMLElement>("[data-banner-lines]", section))
    SplitText.create(el, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.2,
          stagger: 0.12,
          ease: "expo.out",
          scrollTrigger: {
            trigger: section,
            start: "top 40%",
            toggleActions: REPLAY,
          },
        }),
    })
}

// Enquire banner buttons, mouse and keyboard: white rises from the bottom
// edge to fill the button and the label turns navy; it drains on leave.
function bannerButtons() {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
  const stops: (() => void)[] = []

  for (const button of q<HTMLElement>("[data-banner-button]")) {
    const fill = document.createElement("span")
    fill.setAttribute("aria-hidden", "true")
    Object.assign(fill.style, {
      position: "absolute",
      inset: "0",
      zIndex: "-1",
      background: "#fff",
      borderRadius: "inherit",
      pointerEvents: "none",
    })
    Object.assign(button.style, {
      position: "relative",
      isolation: "isolate",
      overflow: "hidden",
    })
    button.append(fill)
    gsap.set(fill, { clipPath: "inset(100% 0% 0% 0%)" })

    const open = () => {
      gsap.to(fill, {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 0.5,
        ease: "power3.out",
        overwrite: true,
      })
      gsap.to(button, { color: "#0d1b36", duration: 0.3, overwrite: true })
    }
    const close = () => {
      gsap.to(fill, {
        clipPath: "inset(100% 0% 0% 0%)",
        duration: 0.45,
        ease: "power3.inOut",
        overwrite: true,
      })
      gsap.to(button, { color: "#ffffff", duration: 0.3, overwrite: true })
    }
    for (const [type, handler] of [
      ["pointerenter", open],
      ["pointerleave", close],
      ["focus", open],
      ["blur", close],
    ] as const) {
      button.addEventListener(type, handler)
      stops.push(() => button.removeEventListener(type, handler))
    }
    stops.push(() => {
      fill.remove()
      button.removeAttribute("style")
    })
  }

  return () => stops.forEach((stop) => stop())
}
