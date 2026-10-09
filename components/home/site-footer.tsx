import Image from "next/image"

import { Container } from "@/components/home/section"
import { contact, groupCompanies, navLinks } from "@/components/home/data"

const headingClass = "text-base font-black tracking-[0.04em] text-brand-green"
const linkClass = "text-[15px] leading-normal text-white/80 hover:text-white"

export function SiteFooter() {
  return (
    <footer className="bg-brand-navy px-6 pt-20 pb-8 md:px-10">
      <Container className="flex flex-col gap-12">
        <div
          data-stagger
          className="grid gap-12 md:grid-cols-2 xl:flex xl:gap-14"
        >
          <div className="flex flex-col items-start gap-5 xl:w-[340px] xl:shrink-0">
            <div className="rounded-[14px] bg-white px-4 py-2.5">
              <div className="relative h-[66px] w-[110px]">
                <Image
                  src="/images/logo.png"
                  alt="Security Partners Ltd."
                  fill
                  sizes="110px"
                  className="object-contain"
                />
              </div>
            </div>
            <p className="text-[15px] leading-[1.65] text-white/70">
              A family-run security company based in Mountmellick, Co. Laois,
              providing first class security services across Ireland since 2008.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-1 flex-col gap-3.5">
            <p className={headingClass}>Quick Links</p>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </a>
            ))}
          </nav>

          <address className="flex flex-1 flex-col gap-3.5 not-italic">
            <p className={headingClass}>Contact</p>
            <p className={linkClass}>{contact.addressLine1}</p>
            <p className={linkClass}>{contact.addressLine2}</p>
            <a href={contact.officeHref} className={linkClass}>
              Tel: {contact.office}
            </a>
            <a href={contact.phone24hHref} className={linkClass}>
              24hr: {contact.phone24h}
            </a>
            <a href={`mailto:${contact.email}`} className={linkClass}>
              {contact.email}
            </a>
          </address>

          <div className="flex flex-col gap-4 xl:w-[300px] xl:shrink-0">
            <p className={headingClass}>OTHER SERVICES IN THE GROUP</p>
            {groupCompanies.map((company) => (
              <a
                key={company.name}
                href={`https://${company.site}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 rounded-2xl bg-white/6 px-4 py-3.5 transition-colors hover:bg-white/10"
              >
                <div className="flex h-14 w-[72px] shrink-0 items-center justify-center rounded-[10px] bg-white p-1.5">
                  <div className="relative h-11 w-[60px]">
                    <Image
                      src={company.logo}
                      alt=""
                      fill
                      sizes="60px"
                      className="object-contain"
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[15px] font-bold text-white">
                    {company.name}
                  </p>
                  <p className="text-[13px] text-white/70">
                    Tel: {company.phone}
                  </p>
                  <p className="text-[13px] text-white/70">{company.site}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/12" />

        <div className="flex flex-col justify-between gap-3 text-sm text-white/60 sm:flex-row">
          <p>© 2026 Security Partners Ltd. All rights reserved.</p>
          <p className="whitespace-pre">
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
            {"   ·   "}
            <a href="#" className="hover:text-white">
              Terms
            </a>
          </p>
        </div>
      </Container>
    </footer>
  )
}
