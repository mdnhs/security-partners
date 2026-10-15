"use client"

import { interpolate, shareHref } from "@/lib/interpolate"

export type ShareLinksProps = {
  title: string
  label: string
  /** "Share on {name}" */
  ariaTemplate: string
  /** href templates with {url} and {title} (lib/interpolate shareHref). */
  networks: { label: string; name: string; href: string }[]
}

// Builds share URLs from the live page address, so no site URL config is needed.
export function ShareLinks({
  title,
  label,
  ariaTemplate,
  networks,
}: ShareLinksProps) {
  return (
    <div className="flex items-center gap-2.5">
      <p className="text-sm leading-[normal] font-bold text-brand-navy">
        {label}
      </p>
      {networks.map((network) => (
        <button
          key={network.name}
          type="button"
          aria-label={interpolate(ariaTemplate, { name: network.name })}
          onClick={() =>
            window.open(
              shareHref(network.href, { url: window.location.href, title }),
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
