const HOUR = new Intl.DateTimeFormat("en-IE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Dublin",
})

/** "Good morning" / "Good afternoon" / "Good evening" by the clock in Ireland. */
export function greetingFor(
  date: Date
): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = Number(HOUR.format(date))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export const firstName = (name: string) =>
  name.trim().split(/\s+/)[0] || "there"
