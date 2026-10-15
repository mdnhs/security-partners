import Image from "next/image"

// Verbatim copy of the static site's ArticleBody block renderer
// (components/blog/article.tsx before Phase 3) and the seeded article body,
// kept as the reference the TipTap renderer must reproduce.
export type PostBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string; cite: string }
  | { type: "image"; src: string; alt: string }
const paragraph = "text-lg leading-[1.75] text-[#3b4556]"
export function LegacyBlock({ block }: { block: PostBlock }) {
  switch (block.type) {
    case "p":
      return <p className={paragraph}>{block.text}</p>
    case "h2":
      return (
        <h2 className="mt-7 text-[26px] leading-[1.25] font-black tracking-[-0.005em] text-brand-navy md:text-[30px]">
          {block.text}
        </h2>
      )
    case "list":
      return (
        <ul className="flex flex-col gap-3.5">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-3.5">
              <Image
                src="/images/check.svg"
                alt=""
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="text-[17px] leading-normal font-medium text-brand-navy">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )
    case "quote":
      return (
        <figure className="flex flex-col gap-3 rounded-[20px] border-l-5 border-brand-green bg-brand-mint px-7 py-8 font-bold md:px-9">
          <blockquote className="text-xl leading-normal text-brand-navy md:text-[22px]">
            “{block.text}”
          </blockquote>
          <figcaption className="text-sm leading-[normal] text-brand-green-dark">
            {block.cite}
          </figcaption>
        </figure>
      )
    case "image":
      return (
        <div className="relative h-64 overflow-hidden rounded-3xl md:h-[400px]">
          <Image
            src={block.src}
            alt={block.alt}
            fill
            sizes="(min-width: 1280px) 776px, 100vw"
            className="object-cover"
          />
        </div>
      )
  }
}
export const legacyBody: PostBlock[] = [
  {
    type: "p",
    text: "When your business closes for the night, it becomes an easy target. A mobile patrol puts clearly identifiable security officers on your premises at set times, so problems are found early and unwanted activity is deterred.",
  },
  { type: "h2", text: "What a scheduled patrol covers" },
  {
    type: "p",
    text: "Every patrol is planned around your site and your schedule. Our officers check the areas that matter most to you and report back to our Operations Team as they go.",
  },
  {
    type: "list",
    items: [
      "Perimeter, doors and windows checked for signs of entry",
      "Lights, alarms and equipment left in a safe state",
      "Tag point checks logged at every stop, in real time",
      "Any issue reported straight to our 24/7 Operations Team",
    ],
  },
  {
    type: "quote",
    text: "A visible security presence is one of the simplest ways to deter break-ins, vandalism and anti-social behaviour.",
    cite: "Security Partners Operations Team",
  },
  { type: "h2", text: "Pairing patrols with key holding" },
  {
    type: "p",
    text: "With key holding, our team holds secure keys to your premises. If your alarm is activated, an officer can be dispatched to deal with the situation, so you are not called out in the middle of the night.",
  },
  {
    type: "image",
    src: "/images/about.png",
    alt: "Security Partners officer completing a patrol report",
  },
  { type: "h2", text: "Is a mobile patrol right for you?" },
  {
    type: "p",
    text: "Mobile patrols suit offices, retail units, building sites and any premises left empty after hours. Get in touch and our team will recommend a patrol plan that fits your site.",
  },
]
