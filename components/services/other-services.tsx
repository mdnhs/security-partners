import { Container, SectionHeading } from "@/components/home/section"
import {
  ServiceCard,
  type ServiceCardData,
  type ServiceCardLabels,
} from "@/components/home/services"

export type OtherServicesProps = {
  eyebrow: string
  heading: string
  intro: string
  /** The next three services after the current one, wrapping around. */
  services: ServiceCardData[]
  labels: ServiceCardLabels
}

export function OtherServices({
  eyebrow,
  heading,
  intro,
  services,
  labels,
}: OtherServicesProps) {
  return (
    <section className="bg-brand-surface px-6 py-20 md:px-10 lg:py-28">
      <Container className="flex flex-col gap-14">
        <SectionHeading eyebrow={eyebrow} title={heading} description={intro} />
        <ul data-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.slug} service={service} labels={labels} />
          ))}
        </ul>
      </Container>
    </section>
  )
}
