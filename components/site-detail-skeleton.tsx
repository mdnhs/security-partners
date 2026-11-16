import { Container } from "@/components/home/section"

const bar = "rounded-full bg-brand-line motion-safe:animate-pulse"

/**
 * What a service, article or job page shows from the moment its response
 * starts until its content has streamed in: the page hero's dark band and
 * the body's two columns as grey placeholders, so the area below the navbar
 * is never blank. Decoration only.
 */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading page">
      {/* The hero: the same dark band and title/breadcrumb rhythm. */}
      <div className="bg-brand-navy px-5 pt-8 pb-9 md:px-10 md:pt-20 md:pb-24 lg:pt-28 lg:pb-30">
        <Container className="flex flex-col gap-4 md:gap-6">
          <div className="h-8 w-52 rounded-full bg-white/15 motion-safe:animate-pulse" />
          <div className="h-10 w-4/5 max-w-xl rounded-xl bg-white/15 motion-safe:animate-pulse md:h-14" />
          <div className="h-4 w-3/5 max-w-md rounded-full bg-white/10 motion-safe:animate-pulse" />
        </Container>
      </div>
      {/* The body: a side list and the text column. */}
      <div className="bg-white px-5 py-10 md:px-10 md:py-20">
        <Container className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-14">
          <div className="hidden flex-col gap-4 lg:flex">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${bar} h-11 w-full rounded-xl`} />
            ))}
          </div>
          <div className="flex flex-col gap-5">
            <div className={`${bar} h-8 w-2/3`} />
            <div className={`${bar} h-4 w-full`} />
            <div className={`${bar} h-4 w-full`} />
            <div className={`${bar} h-4 w-5/6`} />
            <div className="mt-4 aspect-video w-full rounded-2xl bg-brand-line motion-safe:animate-pulse" />
            <div className={`${bar} h-4 w-full`} />
            <div className={`${bar} h-4 w-3/4`} />
          </div>
        </Container>
      </div>
    </div>
  )
}
