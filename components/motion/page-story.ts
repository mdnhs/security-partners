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
  teamStory(desktop)
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

// A standalone photo that already drifts (data-parallax) and has rounded
// corners of its own opens like a window as it arrives: from an inset, rounder
// crop to exactly its normal frame. Frames without their own rounding (a team
// card's portrait, clipped by the card) are left untouched, and the end state
// clips nothing, so the layout is never altered.
function imageWindows() {
  for (const photo of q("[data-parallax]")) {
    const frame = photo.parentElement
    if (!frame || frame.closest("[data-banner], [data-about]")) continue
    if (parseFloat(getComputedStyle(frame).borderTopLeftRadius) === 0) continue
    gsap.fromTo(
      frame,
      { clipPath: "inset(9% 9% 9% 9% round 36px)" },
      {
        clipPath: "inset(0% 0% 0% 0% round 0px)",
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

// Team cards arrive one after another, in order, and each card's contents are
// told in sequence as it scrolls up: the portrait opens from the left, then
// the name, role and bio rise line by line, the rule draws and the email
// settles. Only opacity, transform and clip-path move, and every end state is
// the card as authored, so the layout is untouched.
function teamStory(desktop: boolean) {
  const cards = q<HTMLElement>("[data-team-list] > li")
  cards.forEach((card, index) => {
    const photo = card.firstElementChild as HTMLElement | null
    const textBox = card.lastElementChild as HTMLElement | null
    if (!photo || !textBox) return
    const name = textBox.querySelector<HTMLElement>("h3")
    const role = name?.nextElementSibling ?? null
    const bio = textBox.querySelector<HTMLElement>(":scope > p")
    const rule = textBox.querySelector<HTMLElement>(
      ":scope > div:nth-of-type(2)"
    )
    const email = textBox.querySelector("a")

    const scrub = (start: string, end: string) => ({
      trigger: card,
      start,
      end,
      scrub: 0.8,
    })

    // The card itself: rises into place; side by side, the left one comes
    // from the left and the right one from the right.
    gsap.from(card, {
      autoAlpha: 0,
      y: 80,
      x: desktop ? (index % 2 === 0 ? -50 : 50) : 0,
      ease: "power2.out",
      scrollTrigger: scrub("top 96%", "top 70%"),
    })
    // The portrait opens from the left edge.
    gsap.fromTo(
      photo,
      { clipPath: "inset(0% 100% 0% 0%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "power2.out",
        scrollTrigger: scrub("top 88%", "top 56%"),
      }
    )
    for (const [el, start, end] of [
      [name, "top 78%", "top 58%"],
      [bio, "top 70%", "top 38%"],
    ] as const) {
      if (!el) continue
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            stagger: 0.25,
            ease: "none",
            scrollTrigger: scrub(start, end),
          }),
      })
    }
    if (role)
      gsap.from(role, {
        autoAlpha: 0,
        y: 14,
        ease: "none",
        scrollTrigger: scrub("top 72%", "top 52%"),
      })
    if (rule)
      gsap.from(rule, {
        scaleX: 0,
        transformOrigin: "left center",
        ease: "none",
        scrollTrigger: scrub("top 55%", "top 35%"),
      })
    if (email)
      gsap.from(email, {
        autoAlpha: 0,
        y: 12,
        ease: "none",
        scrollTrigger: scrub("top 48%", "top 28%"),
      })
  })
}
