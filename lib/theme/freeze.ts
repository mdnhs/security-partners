/** `T` with every nested property and array read-only (what deepFreeze makes it). */
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T

// Shared tables (base tokens, presets, the default theme) live for the whole
// server process, so a caller that mutated one would corrupt every later
// render. Frozen all the way down, a stray write throws instead, and the
// read-only type makes it a compile error first.
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value as DeepReadonly<T>
}
