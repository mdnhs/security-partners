import Image from "next/image"

/** Centered card frame for sign-in, two-factor and password pages. */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="relative h-[52px] w-[86px]">
            <Image
              src="/images/logo.png"
              alt="Security Partners Ltd."
              fill
              sizes="86px"
              className="object-contain"
              loading="eager"
            />
          </div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Website admin
          </p>
        </div>
        {children}
      </div>
    </main>
  )
}
