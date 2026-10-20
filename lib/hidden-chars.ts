/**
 * Invisible or reordering characters that never belong in a label (alt text,
 * file names): C0/C1 controls and DEL, Arabic letter mark, Mongolian vowel
 * separator, zero-width space/non-joiner, LRM/RLM, line/paragraph
 * separators, bidi embeddings/overrides/isolates, word joiner and invisible
 * operators, BOM, and Unicode tag characters. They could disguise a name
 * (e.g. "invoice\u202efdp.exe") or hide text from readers.
 *
 * ZWJ (U+200D) is kept: emoji sequences need it.
 */
export const HIDDEN_CHARS =
  /[\u0000-\u001f\u007f-\u009f\u061c\u180e\u200b\u200c\u200e\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\u{e0000}-\u{e007f}]/gu

export const stripHiddenChars = (value: string): string =>
  value.replace(HIDDEN_CHARS, "")
