import { useId } from "react"

import { cn } from "@/lib/utils"

/**
 * The Security Partners mark for admin chrome: a shield with "SP" cut out
 * of it. The letters are stroked paths (no font at runtime), drawn on the
 * 24-unit grid so they stay crisp at 22 px. Square, `currentColor`,
 * decorative (the name sits beside it).
 */
export function SpMark({ className }: { className?: string }) {
  const mask = useId()
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <mask
        id={mask}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="white" />
        <g
          fill="none"
          stroke="black"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* S */}
          <path
            data-glyph="S"
            d="M10.6 9.1C10.2 8.4 9.5 8 8.6 8 7.5 8 6.7 8.6 6.7 9.6c0 2.2 4.2 1.6 4.2 3.8 0 1-.9 1.6-2.2 1.6-.9 0-1.7-.4-2.2-1.1"
          />
          {/* P */}
          <path
            data-glyph="P"
            d="M13.6 15V8h2c1.3 0 2.1.8 2.1 1.9s-.8 1.9-2.1 1.9h-2"
          />
        </g>
      </mask>
      <path
        fill="currentColor"
        mask={`url(#${mask})`}
        d="M12 1.5 3 4.8v6.4c0 5.6 3.8 9.9 9 11.3 5.2-1.4 9-5.7 9-11.3V4.8L12 1.5Z"
      />
    </svg>
  )
}
