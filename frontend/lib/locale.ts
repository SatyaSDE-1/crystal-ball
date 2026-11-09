/** A language code such as "es", "hi-IN" or "zh-Hant-TW" (what navigator.language returns). */
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/
const MAX_LENGTH = 35

/** The value if it looks like a language code, otherwise undefined (so it is simply not sent). */
export function sanitizeLocale(value: string | null | undefined): string | undefined {
  if (!value || value.length > MAX_LENGTH || !LOCALE_PATTERN.test(value)) return undefined
  return value
}

/**
 * The operator's language: whatever the browser is set to. It is sent with
 * the summary and the greeting so they come back in that language.
 */
export function getBrowserLocale(): string | undefined {
  if (typeof navigator === 'undefined') return undefined
  return sanitizeLocale(navigator.language)
}
