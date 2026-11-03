import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(ScrollTrigger, SplitText)

// Play on the way down, rewind when scrolling back above the trigger.
const REPLAY = "play none none reverse"

const q = <T extends Element = HTMLElement>(
  selector: string,
  scope?: Element
) => gsap.utils.toArray<T>(selector, scope)

// Scroll stories for the inner pages. Called by HomeMotion inside its
// gsap.matchMedia (motion users only), so every tween, split and trigger made
// here is reverted with it. Everything is keyed on the markup the page already
// has plus a few data-* hooks; no copy is touched.
export function pageStory(desktop: boolean) {
  sectionHeadings()
  pageHeroShrinks()
  imageWindows()
  countUps()
  checkTicks()
  whyChooseStory(desktop)
}

// Every section heading rises line by line out of a mask. The banner and the
// About story have their own versions.
function sectionHeadings() {
  const headings = q<HTMLElement>("section h2").filter(
    (el) => !el.closest("[data-banner], [data-about], [data-banner-lines]")
  )
  for (const heading of headings)
    SplitText.create(heading, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1,
          stagger: 0.1,
          ease: "expo.out",
          scrollTrigger: {
            trigger: heading,
            start: "top 88%",
            toggleActions: REPLAY,
          },
        }),
    })
}

// An inner page's hero folds into a rounded card as it scrolls away: the sides
// pull in and the bottom corners round off. (The home hero has its own story.)
function pageHeroShrinks() {
  for (const hero of q("[data-hero]")) {
    if (hero.querySelector("[data-count]")) continue
    gsap.fromTo(
      hero,
      { clipPath: "inset(0% 0% 0% 0% round 0px 0px 0px 0px)" },
      {
        clipPath: "inset(0% 3% 0% 3% round 0px 0px 56px 56px)",
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "bottom 85%",
          end: "bottom 15%",
          scrub: true,
        },
      }
    )
  }
}

// A photo that already drifts (data-parallax) also opens like a window as it
// arrives: its frame goes from an inset, rounded crop to the full frame.
function imageWindows() {
  for (const photo of q("[data-parallax]")) {
    const frame = photo.parentElement
    if (!frame || frame.closest("[data-banner], [data-about]")) continue
    gsap.fromTo(
      frame,
      { clipPath: "inset(9% 9% 9% 9% round 36px)" },
      {
        clipPath: "inset(0% 0% 0% 0% round 28px)",
        ease: "none",
        scrollTrigger: {
          trigger: frame,
          start: "top 92%",
          end: "top 40%",
          scrub: true,
        },
      }
    )
  }
}

// Numbers count up once when they arrive; the text always ends as authored.
// Years and other labels that are not quantities are left alone.
function countUps() {
  for (const el of q("[data-countup]")) {
    // The authored text is kept aside: a second run (React strict mode in
    // dev, a re-evaluated media query) must not read a half-counted value.
    el.dataset.countupText ??= el.textContent ?? ""
    const text = el.dataset.countupText
    const match = /^(\d[\d,]*)(.*)$/.exec(text.trim())
    if (!match) continue
    const target = Number(match[1].replaceAll(",", ""))
    if (target >= 1900 && target <= 2100) continue
    const suffix = match[2]
    const counter = { value: 0 }
    el.textContent = `0${suffix}`
    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      once: true,
      onEnter: () =>
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = `${Math.round(counter.value)}${suffix}`
          },
          onComplete: () => {
            el.textContent = text
          },
        }),
    })
  }
}

// Tick marks pop in one after another as each list item is reached.
function checkTicks() {
  for (const tick of q<HTMLElement>('li > img[src$="check.svg"]')) {
    if (tick.closest("[data-about]")) continue
    gsap.from(tick, {
      scale: 0,
      rotate: -90,
      duration: 0.6,
      ease: "back.out(2.4)",
      scrollTrigger: {
        trigger: tick,
        start: "top 90%",
        toggleActions: REPLAY,
      },
    })
  }
}

// "Why choose us": the section becomes a sticky stage. A line fills across the
// top while the reasons light up one after another, like going down a list.
// Phones skip the stage and light each card as it passes.
function whyChooseStory(desktop: boolean) {
  const track = document.querySelector<HTMLElement>("[data-story-track]")
  if (!track) return
  const stage = track.querySelector<HTMLElement>("[data-story-stage]")
  const cards = q("[data-story-card]", track)
  const bar = track.querySelector("[data-story-bar]")
  if (cards.length === 0) return

  if (desktop && stage) {
    const own = getComputedStyle(track)
    gsap.set(stage, {
      position: "sticky",
      top: 0,
      height: "100vh",
      display: "flex",
      alignItems: "center",
      paddingLeft: own.paddingLeft,
      paddingRight: own.paddingRight,
    })
    gsap.set(track, {
      height: `${100 + cards.length * 70}vh`,
      paddingTop: 0,
      paddingBottom: 0,
    })
  }

  gsap.set(cards, { autoAlpha: 0.3, y: 24, scale: 0.96 })
  if (desktop && stage) {
    const story = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: track,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
      },
    })
    if (bar)
      story.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: cards.length }, 0)
    cards.forEach((card, i) =>
      story.to(
        card,
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "power2.out" },
        i
      )
    )
    story.to({}, { duration: 0.6 })
    return
  }

  for (const card of cards)
    gsap.to(card, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      ease: "none",
      scrollTrigger: {
        trigger: card,
        start: "top 85%",
        end: "top 60%",
        scrub: 0.5,
      },
    })
  if (bar)
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: track,
          start: "top 80%",
          end: "bottom 60%",
          scrub: true,
        },
      }
    )
}
