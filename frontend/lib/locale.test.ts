import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserLocale, sanitizeLocale } from './locale'

describe('sanitizeLocale', () => {
  it('keeps a valid language code', () => {
    for (const locale of ['en', 'es', 'hi-IN', 'pt-BR', 'zh-Hant-TW']) {
      expect(sanitizeLocale(locale)).toBe(locale)
    }
  })

  it('drops anything that is not a language code', () => {
    for (const value of ['', 'x', 'english please', 'es;drop table', 'a'.repeat(40)]) {
      expect(sanitizeLocale(value)).toBeUndefined()
    }
  })

  it('drops a missing value', () => {
    expect(sanitizeLocale(undefined)).toBeUndefined()
    expect(sanitizeLocale(null)).toBeUndefined()
  })
})

describe('getBrowserLocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the browser's language", () => {
    vi.stubGlobal('navigator', { language: 'hi-IN' })

    expect(getBrowserLocale()).toBe('hi-IN')
  })

  it('returns nothing when the browser reports something unusable', () => {
    vi.stubGlobal('navigator', { language: '??' })

    expect(getBrowserLocale()).toBeUndefined()
  })

  it('returns nothing outside a browser', () => {
    vi.stubGlobal('navigator', undefined)

    expect(getBrowserLocale()).toBeUndefined()
  })
})
