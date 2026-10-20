import type { ConsentBannerCopy } from "@/components/consent/consent-banner"
import { interpolate } from "@/lib/interpolate"
import {
  type ConsentSettings,
  DEFAULT_CLOSE_LABEL,
  DEFAULT_CONSENT_VERSION,
  DEFAULT_RECONSENT_MONTHS,
} from "@/lib/schemas/settings/consent"

import type { SiteSources } from "./sources"
import { linkView, placeholders } from "./views"

/** Banner copy with {placeholders} filled; the policy link through linkView (ledger ruling). */
export function consentBannerCopy(
  s: SiteSources,
  consent: ConsentSettings
): ConsentBannerCopy {
  const values = placeholders(s)
  const t = (text: string) => interpolate(text, values)
  const category = (c: { label: string; description: string }) => ({
    label: t(c.label),
    description: t(c.description),
  })
  return {
    title: t(consent.title),
    body: t(consent.body),
    acceptLabel: t(consent.acceptLabel),
    rejectLabel: t(consent.rejectLabel),
    customiseLabel: t(consent.customiseLabel),
    saveLabel: t(consent.saveLabel),
    manageLabel: t(consent.manageLabel),
    // Public reads are not re-parsed: a value stored before closeLabel
    // existed has none, so the schema default applies here too.
    closeLabel: t(consent.closeLabel || DEFAULT_CLOSE_LABEL),
    policyLink: linkView(s, consent.policyLink),
    categories: {
      necessary: category(consent.categories.necessary),
      analytics: category(consent.categories.analytics),
      marketing: category(consent.categories.marketing),
    },
    version: consent.version ?? DEFAULT_CONSENT_VERSION,
    reconsentMonths: consent.reconsentMonths ?? DEFAULT_RECONSENT_MONTHS,
  }
}
