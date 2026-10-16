const RINGS = Array.from({ length: 16 }, (_, index) => index)

/** Contour line-art for the navy brand surfaces. Decorative only. */
export function Swirl({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 800 800"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      className={className}
    >
      <g transform="translate(640 700) rotate(-32)">
        {RINGS.map((index) => {
          const rx = 90 + index * 38
          return (
            <ellipse
              key={index}
              cx={index * 9}
              cy={index * -6}
              rx={rx}
              ry={rx * 0.58}
              stroke="white"
              strokeOpacity={0.22 - index * 0.011}
              strokeWidth={1.25}
            />
          )
        })}
      </g>
    </svg>
  )
}
