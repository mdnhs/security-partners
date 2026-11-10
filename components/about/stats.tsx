import { Container } from "@/components/home/section"

export type StatsProps = {
  stats: { value: string; label: string; description: string }[]
}

export function Stats({ stats }: StatsProps) {
  return (
    <section className="bg-brand-navy px-5 py-14 md:px-10 md:py-16 lg:py-20">
      <Container>
        <div className="mb-6 flex flex-col gap-2.5 md:hidden">
          <p className="text-xs font-black tracking-[0.125em] text-brand-green uppercase">
            At a glance
          </p>
          <h2 className="text-[28px] leading-[34px] font-black text-white">
            Security Partners in numbers
          </h2>
        </div>
        <ul
          data-stagger
          className="grid grid-cols-2 gap-3 md:gap-10 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="flex flex-col gap-1 rounded-[18px] border border-white/12 bg-white/6 px-4 pt-[18px] pb-5 md:gap-2 md:rounded-none md:border-0 md:bg-transparent md:p-0"
            >
              <p
                data-countup
                className="text-2xl leading-[30px] font-black tracking-[-0.01em] text-white md:text-[44px] md:leading-[normal] md:text-brand-green"
              >
                {stat.value}
              </p>
              <p className="text-sm leading-[normal] font-bold text-brand-green md:text-lg md:font-black md:text-white">
                {stat.label}
              </p>
              <p className="text-[13px] leading-[19px] text-white/72 md:text-[15px] md:leading-[1.6] md:text-white/70">
                {stat.description}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
