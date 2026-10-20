import { NOISE } from "@/components/admin/kit/noise"
import { Swirl } from "@/components/admin/kit/swirl"
import { BrandMark } from "@/components/admin/shell/brand-mark"
import { AdminThemed } from "@/components/admin/theme/admin-themed"

/**
 * Split layout (JW): navy brand panel left, form panel right. Below
 * 1024 px only the form panel shows. Controls in the form panel are 44 px
 * and rounded-xl.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The published theme in the same boundary: these pages are otherwise
  // static, and would paint in the default tokens first. `noscript` keeps
  // them usable without JavaScript (forgot password posts natively).
  return (
    <AdminThemed noscript>
      <main className="grid min-h-svh gap-4 bg-background p-3 sm:p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section
          aria-hidden
          data-slot="auth-brand"
          className="bg-hero rounded-card relative isolate hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-12"
        >
          <Swirl className="absolute inset-0 -z-10 size-full" />
          <div
            className="absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay"
            style={{ backgroundImage: NOISE }}
          />
          <div className="absolute -top-32 -left-24 -z-10 size-96 rounded-full bg-chart-3/25 blur-3xl" />
          <BrandMark tone="inverse" />
          <div className="flex max-w-lg flex-col gap-5">
            <p className="text-[2.5rem] leading-[1.1] font-bold tracking-tight text-balance">
              Your website, securely under control.
            </p>
            <p className="text-[15px] leading-relaxed text-white/75">
              Pages, services, team and settings in one calm place, with every
              change saved as a draft until you publish.
            </p>
            <ul className="flex flex-wrap gap-2 pt-2 text-[13px] font-medium">
              {["Pages", "Services", "Team", "Settings"].map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-white/10 px-3.5 py-1.5 ring-1 ring-white/15 backdrop-blur-sm"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section
          data-slot="auth-panel"
          className="rounded-card flex flex-col bg-sidebar px-6 py-8 sm:px-10 lg:px-12 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl [&_[data-slot=input]]:bg-card [&_[data-slot=input]]:px-3.5 [&_button[type=submit]]:h-11 [&_button[type=submit]]:w-full [&_button[type=submit]]:rounded-xl [&_button[type=submit]]:font-semibold"
        >
          <BrandMark className="lg:hidden" />
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[400px]">{children}</div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Access is by invitation only. Ask an owner if you need an account.
          </p>
        </section>
      </main>
    </AdminThemed>
  )
}
