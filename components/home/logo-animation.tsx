"use client"

import { useEffect, useRef, useState } from "react"

/**
 * The player's WebAssembly, self-hosted (public/vendor, copied from
 * node_modules/@lottiefiles/dotlottie-web/dist at the pinned version;
 * tests/unit/lottie-wasm.test.ts keeps the copy identical). The package's
 * default is a CDN (jsDelivr / unpkg).
 */
export const LOTTIE_WASM_URL =
  "/vendor/dotlottie-web/0.80.0/dotlottie-player.wasm"

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)"

/**
 * Animated logo (settings.site.logoAnimation) over the static logo, in the
 * same box: a sibling of the logo's <img> inside its positioned wrapper.
 * Client-only: the server HTML is the static logo alone. The player
 * (@lottiefiles/dotlottie-web + its WASM) is a dynamic import, so pages
 * without an animation never load it, and neither do visitors who prefer
 * reduced motion. The canvas appears, and the image is hidden (opacity
 * only: its alt text stays in the accessibility tree), once the first
 * frame is drawn; a file that fails to load leaves the static logo.
 */
export function LogoAnimation({ src }: { src: string }) {
  const [active, setActive] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mount the canvas only when motion is welcome, and drop it when a
  // visitor switches reduced motion on.
  useEffect(() => {
    const query = window.matchMedia(REDUCE_MOTION)
    const update = () => setActive(!query.matches)
    update()
    query.addEventListener?.("change", update)
    return () => query.removeEventListener?.("change", update)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!active || !canvas) return
    const image =
      canvas.parentElement?.querySelector<HTMLImageElement>(":scope > img")
    let cancelled = false
    let player: { destroy(): void } | null = null
    const showImage = () => {
      canvas.style.opacity = "0"
      if (image) image.style.opacity = ""
    }
    import("@lottiefiles/dotlottie-web")
      .then(({ DotLottie }) => {
        if (cancelled) return
        DotLottie.setWasmUrl(LOTTIE_WASM_URL)
        const instance = new DotLottie({
          canvas,
          src,
          loop: true,
          autoplay: true,
          layout: { fit: "contain", align: [0.5, 0.5] },
          renderConfig: { autoResize: true },
        })
        player = instance
        const onFirstFrame = () => {
          instance.removeEventListener("frame", onFirstFrame)
          if (cancelled) return
          canvas.style.opacity = "1"
          if (image) image.style.opacity = "0"
        }
        // "frame" follows each drawn frame (0.80.0 emits no "render" on
        // the main-thread player's playback loop).
        instance.addEventListener("frame", onFirstFrame)
        instance.addEventListener("loadError", () => {
          showImage()
          instance.destroy()
          player = null
          if (!cancelled) setActive(false)
        })
      })
      .catch(() => {
        // The player could not load (offline, blocked): keep the image.
        if (!cancelled) setActive(false)
      })
    return () => {
      cancelled = true
      player?.destroy()
      showImage()
    }
  }, [active, src])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-logo-animation
      className="pointer-events-none absolute inset-0 size-full"
      style={{ opacity: 0 }}
    />
  )
}
