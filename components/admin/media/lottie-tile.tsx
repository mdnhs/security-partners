import { Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Thumbnail of a Lottie animation in the admin (library, picker, details):
 * an icon and "Lottie". The admin never loads the player; the file name
 * and type say which animation it is.
 */
export function LottieTile({ className }: { className?: string }) {
  return (
    <span
      data-lottie-tile
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-muted-foreground",
        className
      )}
    >
      <Sparkles aria-hidden className="size-8" />
      <span className="text-xs font-semibold">Lottie</span>
    </span>
  )
}
