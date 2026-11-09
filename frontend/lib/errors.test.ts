import { describe, expect, it } from 'vitest'
import { ApiError, describeError, errorFromResponse } from './errors'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('errorFromResponse', () => {
  it('maps 429 to rate_limited and reads Retry-After', async () => {
    const error = await errorFromResponse(
      jsonResponse(429, { error: 'Too many', code: 'RATE_LIMITED' }, { 'Retry-After': '42' }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error.kind).toBe('rate_limited')
    expect(error.retryAfterSeconds).toBe(42)
  })

  it('maps 503 to unavailable', async () => {
    const error = await errorFromResponse(
      jsonResponse(503, { error: 'down', code: 'SERVICE_UNAVAILABLE' }),
    )

    expect(error.kind).toBe('unavailable')
  })

  it('maps 400 to validation and keeps the field errors', async () => {
    const errors = [{ field: 'question', message: 'Too small' }]

    const error = await errorFromResponse(
      jsonResponse(400, { error: 'Validation failed', code: 'VALIDATION_ERROR', errors }),
    )

    expect(error.kind).toBe('validation')
    expect(error.fieldErrors).toEqual(errors)
  })

  it('maps anything else to unknown', async () => {
    const error = await errorFromResponse(jsonResponse(500, { error: 'x', code: 'INTERNAL_ERROR' }))

    expect(error.kind).toBe('unknown')
    expect(error.status).toBe(500)
  })

  it('copes with a body that is not JSON', async () => {
    const error = await errorFromResponse(new Response('<html>Bad gateway</html>', { status: 502 }))

    expect(error.kind).toBe('unknown')
  })
})

describe('describeError', () => {
  it('tells the user how long to wait when rate limited', () => {
    const message = describeError(new ApiError('rate_limited', { retryAfterSeconds: 30 }))

    expect(message).toMatch(/30/)
    expect(message).toMatch(/wait/i)
  })

  it('has a friendly message for every kind', () => {
    for (const kind of ['unavailable', 'validation', 'network', 'invalid_response', 'unknown'] as const) {
      const message = describeError(new ApiError(kind))
      expect(message.length).toBeGreaterThan(10)
    }
  })

  it('never leaks technical details', () => {
    const message = describeError(new ApiError('unknown', { status: 500, detail: 'ECONNREFUSED 127.0.0.1:4001' }))

    expect(message).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|500/)
  })

  it('handles errors that are not ApiErrors', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toMatch(/reach the server/i)
    expect(describeError('something odd').length).toBeGreaterThan(10)
  })
})
