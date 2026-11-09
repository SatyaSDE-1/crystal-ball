import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSessionId } from './session'

describe('getSessionId', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a non-empty id', () => {
    expect(getSessionId().length).toBeGreaterThan(8)
  })

  it('returns the same id every time within a browser session', () => {
    expect(getSessionId()).toBe(getSessionId())
  })

  it('remembers the id in sessionStorage, so a reload keeps it', () => {
    const id = getSessionId()

    expect(window.sessionStorage.getItem('cb-session-id')).toBe(id)
  })

  it('reuses an id that is already stored', () => {
    window.sessionStorage.setItem('cb-session-id', 'stored-id')

    expect(getSessionId()).toBe('stored-id')
  })

  it('still works when sessionStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    const first = getSessionId()

    expect(first.length).toBeGreaterThan(8)
    expect(getSessionId()).toBe(first)
  })
})
