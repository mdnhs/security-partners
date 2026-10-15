"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAdminSession } from "@/components/admin/session-provider"
import { cn } from "@/lib/utils"

import { isActiveItem, navItems } from "./nav"

/** Brand mark + "Website admin" label at the top of the navigation. */
export function SidebarBrand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/60"
    >
      <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-md bg-white px-1.5">
        <Image
          src="/images/logo.png"
          alt=""
          width={44}
          height={27}
          className="h-auto w-11"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-bold text-white">
          Security Partners
        </span>
        <span className="text-xs text-sidebar-foreground/70">
          Website admin
        </span>
      </span>
    </Link>
  )
}

/** The permission-filtered navigation (desktop sidebar and mobile sheet). */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { roles } = useAdminSession()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {navItems(roles).map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 text-[11px] font-bold tracking-[0.08em] text-sidebar-foreground/55 uppercase">
            {section.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActiveItem(item, pathname)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/85 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/60",
                      active &&
                        "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-primary"
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Fixed left sidebar from 1024 px (lg) up; below that the topbar opens MobileNav. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  )
}
