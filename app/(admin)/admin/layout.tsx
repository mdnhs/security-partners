import type { Metadata } from "next"
import { Geist_Mono, Lato } from "next/font/google"

import "./admin.css"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
import { cn } from "@/lib/utils"

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: {
    default: "Admin · Security Partners",
    template: "%s · Security Partners admin",
  },
  robots: { index: false, follow: false },
  // The bundled icon (public/favicon.ico); the public site's root layout
  // uses settings.site.favicon when set.
  icons: { icon: "/favicon.ico" },
}

/**
 * Root layout for /admin (separate from the public site's). admin.css is
 * the admin's Tailwind entry: it imports the public globals.css and adds
 * the admin tokens, all under html[data-admin].
 */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      data-admin=""
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        lato.variable
      )}
    >
      <body className="min-h-svh bg-background text-foreground">
        <AdminThemeProvider>{children}</AdminThemeProvider>
      </body>
    </html>
  )
}
