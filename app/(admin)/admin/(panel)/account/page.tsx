import { Eye } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { ChangePasswordForm } from "@/components/admin/account/change-password-form"
import { ProfileForm } from "@/components/admin/account/profile-form"
import { SessionsList } from "@/components/admin/account/sessions-list"
import { ThemePreference } from "@/components/admin/account/theme-preference"
import { TwoFactorSettings } from "@/components/admin/account/two-factor-settings"
import { FormCard } from "@/components/admin/form/form-ui"
import { EmptyState } from "@/components/admin/kit/empty-state"
import { PageHeader } from "@/components/admin/page-header"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Account" }

// JW account: Profile (+ Appearance), Security (Password + 2FA), Devices.
const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "sessions", label: "Devices" },
]

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <Account />
    </Suspense>
  )
}

async function Account() {
  const { user, session } = await requireSession()
  if (session.impersonatedBy)
    return (
      <>
        <PageHeader title="Account" description={user.email} />
        <EmptyState
          icon={Eye}
          title={`You're viewing as ${user.name}`}
          description="Their profile, password and devices can only be changed by them. Stop impersonating to manage your own account."
        />
      </>
    )
  return (
    <>
      <PageHeader title="Account" description={user.email} />
      <SectionTabs ariaLabel="Account sections" heading="Account" items={TABS}>
        <SectionTabsPanel id="profile">
          <div className="grid gap-4 xl:grid-cols-2">
            <FormCard
              id="account-profile"
              title="Profile"
              description="Your name and job title appear on articles you write."
            >
              <ProfileForm
                name={user.name}
                email={user.email}
                title={user.title}
              />
            </FormCard>
            <FormCard
              id="account-appearance"
              title="Appearance"
              description="Light, dark, or whatever your system uses. Only the admin changes."
            >
              <ThemePreference />
            </FormCard>
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="security">
          <div className="grid gap-4 xl:grid-cols-2">
            <FormCard
              id="account-password"
              title="Password"
              description="Changing your password signs out your other devices."
            >
              <ChangePasswordForm />
            </FormCard>
            <FormCard
              id="account-two-factor"
              title="Two-factor authentication"
              description="A code from your phone in addition to your password."
            >
              <TwoFactorSettings enabled={user.twoFactorEnabled} />
            </FormCard>
          </div>
        </SectionTabsPanel>
        <SectionTabsPanel id="sessions">
          <FormCard
            id="account-sessions"
            title="Signed-in devices"
            description="Where your account is signed in. Sign out anything you do not recognise."
          >
            <SessionsList currentSessionId={session.id} />
          </FormCard>
        </SectionTabsPanel>
      </SectionTabs>
    </>
  )
}
