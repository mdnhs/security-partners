import { SettingsTabs } from "@/components/admin/settings/settings-tabs"

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SettingsTabs>{children}</SettingsTabs>
}
