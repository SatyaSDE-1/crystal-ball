import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/errors'
import type { ChatEvent } from '@/lib/contracts'
import { createAssistantService } from './assistant-service'

const BASE = 'http://api.test/api'
const encoder = new TextEncoder()

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function sse(...parts: string[]) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function build(fetchImpl: typeof fetch) {
  return createAssistantService({ baseUrl: BASE, fetch: fetchImpl, getSessionId: () => 'session-1' })
}

async function collect(source: AsyncIterable<ChatEvent>) {
  const events: ChatEvent[] = []
  for await (const event of source) events.push(event)
  return events
}

const validSummary = {
  headline: '4 approvals pending review; 1 high priority.',
  items: [{ id: 'apr-3', urgency: 'high', reason: 'Safety specs.' }],
  source: 'ai',
}

describe('createAssistantService', () => {
  describe('requests', () => {
    it('POSTs the greeting to /greeting with JSON and the session header', async () => {
      const fetchMock = vi.fn().mockResolvedValue(json(200, { text: 'Hi! 4 pending.', source: 'ai' }))

      await build(fetchMock).getGreeting()

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${BASE}/greeting`)
      expect(init.method).toBe('POST')
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        'x-session-id': 'session-1',
      })
      expect(init.body).toBe('{}')
    })

    it('POSTs the summary to /summary', async () => {
      const fetchMock = vi.fn().mockResolvedValue(json(200, validSummary))

      await build(fetchMock).getSummary()

      expect((fetchMock.mock.calls[0] as [string])[0]).toBe(`${BASE}/summary`)
    })

    it('POSTs the question to /help', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(json(200, { answer: 'Reject corrupt files.', citations: ['rejection-criteria'], source: 'ai' }))

      await build(fetchMock).askHelp('What are the rejection criteria?')

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${BASE}/help`)
      expect(JSON.parse(init.body as string)).toEqual({ question: 'What are the rejection criteria?' })
    })

    it('POSTs the conversation to /chat with the session id in the body too', async () => {
      const fetchMock = vi.fn().mockResolvedValue(sse('event: done\ndata: {}\n\n'))
      const messages = [{ role: 'user' as const, content: 'Which approval is first?' }]

      await collect(build(fetchMock).streamChat({ mode: 'talk', messages }))

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe(`${BASE}/chat`)
      expect(JSON.parse(init.body as string)).toEqual({ sessionId: 'session-1', mode: 'talk', messages })
      expect(init.headers).toMatchObject({ 'x-session-id': 'session-1' })
    })

    it('passes the abort signal to fetch', async () => {
      const fetchMock = vi.fn().mockResolvedValue(json(200, validSummary))
      const controller = new AbortController()

      await build(fetchMock).getSummary(controller.signal)

      expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].signal).toBe(controller.signal)
    })
  })

  describe('responses are validated, never trusted', () => {
    it('returns a valid greeting, summary and help answer', async () => {
      const service = build(
        vi
          .fn()
          .mockResolvedValueOnce(json(200, { text: 'Hi', source: 'fallback' }))
          .mockResolvedValueOnce(json(200, validSummary))
          .mockResolvedValueOnce(json(200, { answer: 'A', citations: [], source: 'ai' })),
      )

      await expect(service.getGreeting()).resolves.toEqual({ text: 'Hi', source: 'fallback' })
      await expect(service.getSummary()).resolves.toEqual(validSummary)
      await expect(service.askHelp('abc')).resolves.toEqual({ answer: 'A', citations: [], source: 'ai' })
    })

    it('rejects a summary with an unknown urgency', async () => {
      const bad = { ...validSummary, items: [{ id: 'apr-3', urgency: 'critical', reason: 'x' }] }

      await expect(build(vi.fn().mockResolvedValue(json(200, bad))).getSummary()).rejects.toMatchObject({
        kind: 'invalid_response',
      })
    })

    it('rejects a greeting that is missing its text', async () => {
      await expect(
        build(vi.fn().mockResolvedValue(json(200, { source: 'ai' }))).getGreeting(),
      ).rejects.toMatchObject({ kind: 'invalid_response' })
    })

    it('rejects a body that is not JSON', async () => {
      const response = new Response('<html>oops</html>', { status: 200 })

      await expect(build(vi.fn().mockResolvedValue(response)).getGreeting()).rejects.toMatchObject({
        kind: 'invalid_response',
      })
    })
  })

  describe('errors', () => {
    it('turns 429 into rate_limited with the wait time', async () => {
      const response = json(429, { error: 'Too many', code: 'RATE_LIMITED' }, { 'Retry-After': '60' })

      await expect(build(vi.fn().mockResolvedValue(response)).getSummary()).rejects.toMatchObject({
        kind: 'rate_limited',
        retryAfterSeconds: 60,
      })
    })

    it('turns 503 into unavailable', async () => {
      const response = json(503, { error: 'down', code: 'SERVICE_UNAVAILABLE' })

      await expect(build(vi.fn().mockResolvedValue(response)).askHelp('abc')).rejects.toMatchObject({
        kind: 'unavailable',
      })
    })

    it('turns 400 into validation', async () => {
      const response = json(400, { error: 'Validation failed', code: 'VALIDATION_ERROR', errors: [] })

      await expect(build(vi.fn().mockResolvedValue(response)).askHelp('abc')).rejects.toMatchObject({
        kind: 'validation',
      })
    })

    it('turns a network failure into network', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      const error = await build(fetchMock).getGreeting().catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).kind).toBe('network')
    })

    it('lets an abort through unchanged, so callers can tell it apart', async () => {
      const abort = new DOMException('Aborted', 'AbortError')

      const error = await build(vi.fn().mockRejectedValue(abort)).getGreeting().catch((e: unknown) => e)

      expect(error).toBe(abort)
    })
  })

  describe('streamChat', () => {
    const request = { mode: 'talk' as const, messages: [{ role: 'user' as const, content: 'Hi' }] }

    it('yields token events, then done', async () => {
      const response = sse(
        'event: token\ndata: {"text":"Hel"}\n\n',
        'event: token\ndata: {"text":"lo"}\n\n',
        'event: done\ndata: {}\n\n',
      )

      const events = await collect(build(vi.fn().mockResolvedValue(response)).streamChat(request))

      expect(events).toEqual([
        { type: 'token', text: 'Hel' },
        { type: 'token', text: 'lo' },
        { type: 'done' },
      ])
    })

    it('yields an error event from the server', async () => {
      const response = sse('event: error\ndata: {"message":"Try again in a moment."}\n\n')

      const events = await collect(build(vi.fn().mockResolvedValue(response)).streamChat(request))

      expect(events).toEqual([{ type: 'error', message: 'Try again in a moment.' }])
    })

    it('handles events split across network chunks', async () => {
      const response = sse('event: tok', 'en\ndata: {"text"', ':"Hi"}\n\nevent: done\ndata: {}\n\n')

      const events = await collect(build(vi.fn().mockResolvedValue(response)).streamChat(request))

      expect(events).toEqual([{ type: 'token', text: 'Hi' }, { type: 'done' }])
    })

    it('skips frames it does not understand', async () => {
      const response = sse(
        'event: mystery\ndata: {}\n\n',
        'event: token\ndata: {"nope":1}\n\n',
        'event: token\ndata: not json\n\n',
        'event: token\ndata: {"text":"ok"}\n\n',
        'event: done\ndata: {}\n\n',
      )

      const events = await collect(build(vi.fn().mockResolvedValue(response)).streamChat(request))

      expect(events).toEqual([{ type: 'token', text: 'ok' }, { type: 'done' }])
    })

    it('throws rate_limited before any token when the server answers 429', async () => {
      const response = json(429, { error: 'Too many', code: 'RATE_LIMITED' }, { 'Retry-After': '20' })

      await expect(
        collect(build(vi.fn().mockResolvedValue(response)).streamChat(request)),
      ).rejects.toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 20 })
    })

    it('throws validation when the server answers 400', async () => {
      const response = json(400, { error: 'Validation failed', code: 'VALIDATION_ERROR', errors: [] })

      await expect(
        collect(build(vi.fn().mockResolvedValue(response)).streamChat(request)),
      ).rejects.toMatchObject({ kind: 'validation' })
    })

    it('throws network when the request cannot be made', async () => {
      await expect(
        collect(build(vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))).streamChat(request)),
      ).rejects.toMatchObject({ kind: 'network' })
    })

    it('throws when the response has no body to read', async () => {
      const response = new Response(null, { status: 200 })

      await expect(
        collect(build(vi.fn().mockResolvedValue(response)).streamChat(request)),
      ).rejects.toMatchObject({ kind: 'invalid_response' })
    })
  })
})
