import type { z } from 'zod'
import { API_BASE_URL } from '@/lib/config'
import {
  type ChatEvent,
  ChatEvent as ChatEventSchema,
  type ChatMode,
  type ChatTurn,
  type GreetingResponse,
  GreetingResponse as GreetingResponseSchema,
  type HelpResponse,
  HelpResponse as HelpResponseSchema,
  type SummaryResponse,
  SummaryResponse as SummaryResponseSchema,
} from '@/lib/contracts'
import { ApiError, errorFromResponse, isAbortError } from '@/lib/errors'
import { getSessionId } from '@/lib/session'
import { parseSseStream } from '@/services/sse'

export type ChatRequest = { mode: ChatMode; messages: ChatTurn[] }

/** Everything the assistant UI needs from the backend. Swap it to test or mock the UI. */
export interface AssistantService {
  getGreeting(signal?: AbortSignal): Promise<GreetingResponse>
  getSummary(signal?: AbortSignal): Promise<SummaryResponse>
  askHelp(question: string, signal?: AbortSignal): Promise<HelpResponse>
  streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatEvent>
}

type Options = {
  baseUrl: string
  fetch?: typeof fetch
  getSessionId?: () => string
}

async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError('network', { detail: error instanceof Error ? error.message : String(error) })
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

export function createAssistantService({
  baseUrl,
  fetch: fetchImpl = (...args) => fetch(...args),
  getSessionId: sessionId = getSessionId,
}: Options): AssistantService {
  /** POSTs JSON. Aborts pass through untouched; every other failure becomes an ApiError. */
  async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    let response: Response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId() },
        body: JSON.stringify(body),
        signal,
      })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new ApiError('network', { detail: error instanceof Error ? error.message : String(error) })
    }

    if (!response.ok) throw await errorFromResponse(response)
    return response
  }

  async function postJson<S extends z.ZodType>(
    path: string,
    body: unknown,
    schema: S,
    signal?: AbortSignal,
  ): Promise<z.infer<S>> {
    const response = await post(path, body, signal)

    let data: unknown
    try {
      data = await response.json()
    } catch {
      throw new ApiError('invalid_response', { detail: 'The response was not JSON' })
    }

    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      throw new ApiError('invalid_response', { detail: parsed.error.message })
    }
    return parsed.data
  }

  async function* streamChat(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
    const response = await post('/chat', { sessionId: sessionId(), ...request }, signal)
    if (!response.body) throw new ApiError('invalid_response', { detail: 'The response had no body' })

    for await (const frame of parseSseStream(readChunks(response.body))) {
      let payload: unknown
      try {
        payload = JSON.parse(frame.data)
      } catch {
        continue // not JSON: skip it
      }

      const fields = typeof payload === 'object' && payload !== null ? payload : {}
      const event = ChatEventSchema.safeParse({ ...fields, type: frame.event })
      if (event.success) yield event.data // unknown or malformed events are skipped
    }
  }

  return {
    getGreeting: signal => postJson('/greeting', {}, GreetingResponseSchema, signal),
    getSummary: signal => postJson('/summary', {}, SummaryResponseSchema, signal),
    askHelp: (question, signal) => postJson('/help', { question }, HelpResponseSchema, signal),
    streamChat,
  }
}

/** The service the app uses: the real gateway. */
export const assistantService = createAssistantService({ baseUrl: API_BASE_URL })
