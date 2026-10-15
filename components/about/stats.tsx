import { Container } from "@/components/home/section"
import { stats } from "@/components/about/data"

export function Stats() {
  return (
    <section className="bg-brand-navy px-6 py-16 md:px-10 lg:py-20">
      <Container>
        <ul data-stagger className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <li key={stat.label} className="flex flex-col gap-2">
              <p className="text-[44px] leading-[normal] font-black tracking-[-0.01em] text-brand-green">
                {stat.value}
              </p>
              <p className="text-lg leading-[normal] font-black text-white">
                {stat.label}
              </p>
              <p className="text-[15px] leading-[1.6] text-white/70">
                {stat.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
