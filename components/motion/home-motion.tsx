"use client"

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"
import { useGSAP } from "@gsap/react"

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)

// Play on the way down, rewind when scrolling back above the trigger.
const REPLAY = "play none none reverse"

const q = <T extends Element = HTMLElement>(selector: string) =>
  gsap.utils.toArray<T>(selector)

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
        banner()
        map()
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

function banner() {
  const card = document.querySelector("[data-banner]")
  if (!card) return

  gsap.fromTo(
    card,
    { scale: 0.92, borderRadius: 64 },
    {
      scale: 1,
      borderRadius: 32,
      ease: "none",
      scrollTrigger: {
        trigger: card,
        start: "top bottom",
        end: "center 60%",
        scrub: true,
      },
    }
  )
  gsap.from("[data-banner-item]", {
    autoAlpha: 0,
    y: 30,
    duration: 0.9,
    stagger: 0.1,
    ease: "power3.out",
    scrollTrigger: { trigger: card, start: "top 70%", toggleActions: REPLAY },
  })
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
