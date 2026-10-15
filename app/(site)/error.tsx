"use client"

import { useEffect } from "react"

import { buttonClassName } from "@/components/ui/button"
import { PageHero } from "@/components/home/page-hero"
import { Container } from "@/components/home/section"
import { HomeMotion } from "@/components/motion/home-motion"

/**
 * Public error boundary (Review Focus 4): shown when a page cannot load,
 * e.g. the database is unreachable. It cannot read settings, so its copy
 * is fixed here, styled with the site's own PageHero. No error details are
 * shown (production errors from the server carry only a digest).
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <>
      <main>
        <PageHero
          image="/images/hero.jpg"
          crumb="Error"
          title="Something went wrong"
          description="This page could not be loaded. Please try again in a moment."
          homeLabel="Home"
          ariaLabel="Breadcrumb"
        />
        <section className="bg-white px-6 py-20 md:px-10">
          <Container className="flex justify-center">
            <button
              type="button"
              onClick={() => retry()}
              className={buttonClassName({ variant: "brand", size: "pill" })}
            >
              Try again
            </button>
          </Container>
        </section>
      </main>
      <HomeMotion />
    </>
  )
}
