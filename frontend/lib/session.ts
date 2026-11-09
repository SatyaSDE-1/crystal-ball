const STORAGE_KEY = 'cb-session-id'

let memoryId: string | null = null

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/**
 * The id sent as `x-session-id`, which the API uses to rate-limit per
 * session. Kept in sessionStorage so a reload keeps it; if storage is blocked
 * (private mode, strict settings) it lives in memory for the page's lifetime.
 */
export function getSessionId(): string {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    if (stored) return stored

    const id = memoryId ?? newId()
    window.sessionStorage.setItem(STORAGE_KEY, id)
    memoryId = id
    return id
  } catch {
    memoryId ??= newId()
    return memoryId
  }
}
