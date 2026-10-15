import type { Metadata } from "next"
import { Geist_Mono, Lato } from "next/font/google"

import "../../globals.css"
import { ThemeProvider } from "@/components/theme-provider"
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
}

/** Root layout for /admin (separate from the public site's root layout). */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        lato.variable
      )}
    >
      <body className="min-h-svh bg-muted/40">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
