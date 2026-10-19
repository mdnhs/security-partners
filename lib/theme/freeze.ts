// Shared tables (base tokens, presets, the default theme) live for the whole
// server process, so a caller that mutated one would corrupt every later
// render. Frozen all the way down, a stray write throws instead.
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
