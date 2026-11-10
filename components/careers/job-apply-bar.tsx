"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

import { SlideInBar } from "@/components/motion/slide-in-bar"

/**
 * Phones: the job page's fixed bottom action bar (Apply now). It stands in
 * for the site-wide call/quote bar, which globals.css hides while this page
 * is open (data-apply-flow="done" hides only that bar).
 */
export function JobApplyBar({ href, label }: { href: string; label: string }) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.applyFlow = "done"
    return () => {
      delete root.dataset.applyFlow
    }
  }, [])
  return (
    <SlideInBar className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-white px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0px_-6px_20px_0px_rgba(13,27,54,0.1)] md:hidden">
      <Link
        href={href}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand-green px-6 text-base font-bold text-white"
      >
        {label}
        <ArrowRight aria-hidden className="size-5" />
      </Link>
    </SlideInBar>
  )
}
