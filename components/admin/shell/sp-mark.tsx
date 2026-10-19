import { useId } from "react"

import { cn } from "@/lib/utils"

/**
 * The Security Partners mark for admin chrome: a shield with "SP" cut out
 * of it. Square, `currentColor`, decorative (the name sits beside it).
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
        <text
          x="12"
          y="14.6"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="800"
          letterSpacing="-0.3"
          fontFamily="inherit"
          fill="black"
        >
          SP
        </text>
      </mask>
      <path
        fill="currentColor"
        mask={`url(#${mask})`}
        d="M12 1.5 3 4.8v6.4c0 5.6 3.8 9.9 9 11.3 5.2-1.4 9-5.7 9-11.3V4.8L12 1.5Z"
      />
    </svg>
  )
}
