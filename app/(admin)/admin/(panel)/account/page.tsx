import type { Metadata } from "next"
import { Suspense } from "react"

import { AccountSection } from "@/components/admin/account/account-section"
import { ChangePasswordForm } from "@/components/admin/account/change-password-form"
import { ProfileForm } from "@/components/admin/account/profile-form"
import { SessionsList } from "@/components/admin/account/sessions-list"
import { TwoFactorSettings } from "@/components/admin/account/two-factor-settings"
import { FormNotice } from "@/components/admin/auth/form-messages"
import {
  SectionTabs,
  SectionTabsPanel,
} from "@/components/admin/section-tabs/section-tabs"
import { requireSession } from "@/server/auth/session"

export const metadata: Metadata = { title: "Account" }

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Password" },
  { id: "two-factor", label: "Two-factor" },
  { id: "sessions", label: "Sessions" },
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
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Account</h1>
      {session.impersonatedBy ? (
        <FormNotice>
          You are viewing the admin as {user.name}. Account settings are
          disabled while impersonating.
        </FormNotice>
      ) : (
        <SectionTabs ariaLabel="Account sections" items={TABS}>
          <SectionTabsPanel id="profile">
            <AccountSection
              title="Profile"
              description="Your name and job title appear on articles you write."
            >
              <ProfileForm
                name={user.name}
                email={user.email}
                title={user.title}
              />
            </AccountSection>
          </SectionTabsPanel>
          <SectionTabsPanel id="password">
            <AccountSection
              title="Password"
              description="Changing your password signs out your other devices."
            >
              <ChangePasswordForm />
            </AccountSection>
          </SectionTabsPanel>
          <SectionTabsPanel id="two-factor">
            <AccountSection
              title="Two-factor authentication"
              description="A code from your phone in addition to your password."
            >
              <TwoFactorSettings enabled={user.twoFactorEnabled} />
            </AccountSection>
          </SectionTabsPanel>
          <SectionTabsPanel id="sessions">
            <AccountSection
              title="Sessions"
              description="Where your account is signed in. Sign out anything you do not recognise."
            >
              <SessionsList currentSessionId={session.id} />
            </AccountSection>
          </SectionTabsPanel>
        </SectionTabs>
      )}
    </div>
  )
}
