import { Container, SectionHeading } from "@/components/home/section"
import { services } from "@/components/home/data"
import { ServiceCard } from "@/components/home/services"

// The next three services after the current one, wrapping around the list.
export function OtherServices({ slug }: { slug: string }) {
  const index = services.findIndex((service) => service.slug === slug)
  const others = [1, 2, 3].map(
    (offset) => services[(index + offset) % services.length]
  )

  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow="More services"
          title="Other Services"
          description="Explore the rest of our security services."
        />
        <ul data-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </ul>
      </Container>
    </section>
  )
}
