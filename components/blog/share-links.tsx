"use client"

const networks = [
  {
    label: "f",
    name: "Facebook",
    href: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    label: "in",
    name: "LinkedIn",
    href: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    label: "X",
    name: "X",
    href: (url: string, title: string) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
]

// Builds share URLs from the live page address, so no site URL config is needed.
export function ShareLinks({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="text-sm leading-[normal] font-bold text-brand-navy">
        Share:
      </p>
      {networks.map((network) => (
        <button
          key={network.name}
          type="button"
          aria-label={`Share on ${network.name}`}
          onClick={() =>
            window.open(
              network.href(window.location.href, title),
              "_blank",
              "noopener,noreferrer"
            )
          }
          className="flex size-9 items-center justify-center rounded-full bg-brand-blue text-[13px] leading-[normal] font-black text-white transition-colors hover:bg-brand-navy"
        >
          {network.label}
        </button>
      ))}
    </div>
  )
}
