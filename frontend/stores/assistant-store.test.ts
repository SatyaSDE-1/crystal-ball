import { describe, expect, it, vi, type Mock } from 'vitest'
import { approvalFixtures } from '@/fixtures/approvals'
import type { ChatEvent, HelpResponse, SummaryResponse } from '@/lib/contracts'
import { ApiError } from '@/lib/errors'
import type { AssistantService } from '@/services/assistant-service'
import { createChannel } from '@/test-utils/channel'
import { createAssistantStore } from './assistant-store'

const summary: SummaryResponse = {
  headline: '4 approvals pending review; 1 high priority.',
  items: [
    { id: 'apr-3', urgency: 'high', reason: 'Safety specs.' },
    { id: 'apr-1', urgency: 'medium', reason: 'Onboarding.' },
  ],
  source: 'ai',
}

const helpAnswer: HelpResponse = {
  answer: 'Reject corrupt files.',
  citations: ['rejection-criteria'],
  source: 'ai',
}

/** Every method of the service, as a mock the tests can inspect and re-script. */
type FakeMethods = { [K in keyof AssistantService]: Mock }

function fakeService(overrides: Partial<FakeMethods> = {}) {
  const service: FakeMethods = {
    getGreeting: vi.fn().mockResolvedValue({ text: 'Good morning! 4 approvals await.', source: 'ai' }),
    getSummary: vi.fn().mockResolvedValue(summary),
    askHelp: vi.fn().mockResolvedValue(helpAnswer),
    streamChat: vi.fn(),
    ...overrides,
  }
  return service as AssistantService & FakeMethods
}

function setup(service = fakeService()) {
  const store = createAssistantStore(service)
  store.getState().setApprovals(approvalFixtures)
  return { store, service }
}

/** A chat stream the test drives by hand; aborting it fails it like fetch would. */
function liveStream(service: ReturnType<typeof fakeService>) {
  const channel = createChannel<ChatEvent>()
  service.streamChat.mockImplementation((_request: unknown, signal?: AbortSignal) => {
    signal?.addEventListener('abort', () => channel.fail(new DOMException('Aborted', 'AbortError')))
    return channel.iterable
  })
  return channel
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('assistant store', () => {
  describe('initial state', () => {
    it('starts on the home view with nothing loaded', () => {
      const { store } = setup()
      const state = store.getState()

      expect(state.view).toBe('home')
      expect(state.greeting.status).toBe('idle')
      expect(state.summary.status).toBe('idle')
      expect(state.help.entries).toEqual([])
      expect(state.chats.talk.messages).toEqual([])
      expect(state.chats.teach.messages).toEqual([])
    })

    it('knows the approvals it was given', () => {
      const { store } = setup()

      expect(store.getState().approvals).toHaveLength(4)
    })
  })

  describe('navigation', () => {
    it('opens a view and goes back home', () => {
      const { store } = setup()

      store.getState().openView('talk')
      expect(store.getState().view).toBe('talk')

      store.getState().goHome()
      expect(store.getState().view).toBe('home')
    })

    it('opening the summary view starts loading it', async () => {
      const { store, service } = setup()

      store.getState().openView('summary')

      expect(store.getState().view).toBe('summary')
      expect(store.getState().summary.status).toBe('loading')
      await flush()
      expect(service.getSummary).toHaveBeenCalledTimes(1)
    })

    it('does not reload an already loaded summary when reopened', async () => {
      const { store, service } = setup()
      store.getState().openView('summary')
      await flush()

      store.getState().goHome()
      store.getState().openView('summary')
      await flush()

      expect(service.getSummary).toHaveBeenCalledTimes(1)
    })
  })

  describe('greeting', () => {
    it('loads the greeting: loading, then the text and its source', async () => {
      const { store } = setup()

      const pending = store.getState().loadGreeting()
      expect(store.getState().greeting.status).toBe('loading')
      await pending

      expect(store.getState().greeting).toMatchObject({
        status: 'success',
        text: 'Good morning! 4 approvals await.',
        source: 'ai',
      })
    })

    it('does not refetch a greeting it already has', async () => {
      const { store, service } = setup()
      await store.getState().loadGreeting()

      await store.getState().loadGreeting()

      expect(service.getGreeting).toHaveBeenCalledTimes(1)
    })

    it('replayGreeting fetches a fresh one', async () => {
      const service = fakeService({
        getGreeting: vi
          .fn()
          .mockResolvedValueOnce({ text: 'First! 4 pending.', source: 'ai' })
          .mockResolvedValueOnce({ text: 'Second! 4 pending.', source: 'ai' }),
      })
      const { store } = setup(service)
      await store.getState().loadGreeting()

      await store.getState().replayGreeting()

      expect(store.getState().greeting.text).toBe('Second! 4 pending.')
      expect(service.getGreeting).toHaveBeenCalledTimes(2)
    })

    it('keeps the old greeting visible while a replay is loading', async () => {
      const { store } = setup()
      await store.getState().loadGreeting()

      const replay = store.getState().replayGreeting()

      expect(store.getState().greeting.status).toBe('loading')
      expect(store.getState().greeting.text).toBe('Good morning! 4 approvals await.')
      await replay
    })

    it('falls back to a local greeting when the API cannot be reached', async () => {
      const service = fakeService({ getGreeting: vi.fn().mockRejectedValue(new ApiError('network')) })
      const { store } = setup(service)

      await store.getState().loadGreeting()

      expect(store.getState().greeting).toMatchObject({
        status: 'success',
        text: 'Hello, Operator! You have 4 approvals pending.',
        source: 'fallback',
      })
    })

    it('words the local greeting for one and for zero pending items', async () => {
      const service = fakeService({ getGreeting: vi.fn().mockRejectedValue(new ApiError('network')) })
      const { store } = setup(service)

      store.getState().setApprovals(approvalFixtures.slice(0, 1))
      await store.getState().loadGreeting(true)
      expect(store.getState().greeting.text).toBe('Hello, Operator! You have 1 approval pending.')

      store.getState().setApprovals([])
      await store.getState().loadGreeting(true)
      expect(store.getState().greeting.text).toBe('Hello, Operator! You have no approvals pending.')
    })

    it('ignores a greeting that comes back after a newer replay', async () => {
      let resolveFirst: (value: { text: string; source: 'ai' }) => void = () => {}
      const service = fakeService({
        getGreeting: vi
          .fn()
          .mockImplementationOnce(() => new Promise(resolve => (resolveFirst = resolve)))
          .mockResolvedValueOnce({ text: 'Newer! 4 pending.', source: 'ai' }),
      })
      const { store } = setup(service)

      const first = store.getState().loadGreeting()
      await store.getState().replayGreeting()
      resolveFirst({ text: 'Stale! 4 pending.', source: 'ai' })
      await first

      expect(store.getState().greeting.text).toBe('Newer! 4 pending.')
    })
  })

  describe('summary', () => {
    it('loads the summary', async () => {
      const { store } = setup()

      await store.getState().loadSummary()

      expect(store.getState().summary).toMatchObject({ status: 'success', data: summary, error: null })
    })

    it('shows a friendly error when it fails, and can retry', async () => {
      const service = fakeService({
        getSummary: vi.fn().mockRejectedValueOnce(new ApiError('unavailable')).mockResolvedValueOnce(summary),
      })
      const { store } = setup(service)

      await store.getState().loadSummary()
      expect(store.getState().summary.status).toBe('error')
      expect(store.getState().summary.error).toMatch(/unavailable/i)

      await store.getState().loadSummary(true)
      expect(store.getState().summary).toMatchObject({ status: 'success', data: summary })
    })

    it('tells a rate-limited user how long to wait', async () => {
      const service = fakeService({
        getSummary: vi.fn().mockRejectedValue(new ApiError('rate_limited', { retryAfterSeconds: 45 })),
      })
      const { store } = setup(service)

      await store.getState().loadSummary()

      expect(store.getState().summary.error).toMatch(/45/)
    })

    it('does not load twice at once', async () => {
      const { store, service } = setup()

      await Promise.all([store.getState().loadSummary(), store.getState().loadSummary()])

      expect(service.getSummary).toHaveBeenCalledTimes(1)
    })
  })

  describe('help', () => {
    it('asks a question: a loading entry first, then the answer', async () => {
      const { store } = setup()

      const pending = store.getState().askHelp('What are the rejection criteria?')
      expect(store.getState().help.entries[0]).toMatchObject({
        question: 'What are the rejection criteria?',
        status: 'loading',
      })
      await pending

      expect(store.getState().help.entries[0]).toMatchObject({
        status: 'success',
        data: helpAnswer,
        error: null,
      })
    })

    it('keeps every question and answer, newest last', async () => {
      const { store } = setup()

      await store.getState().askHelp('First question?')
      await store.getState().askHelp('Second question?')

      expect(store.getState().help.entries.map(e => e.question)).toEqual(['First question?', 'Second question?'])
    })

    it('records a friendly error on the entry that failed', async () => {
      const service = fakeService({ askHelp: vi.fn().mockRejectedValue(new ApiError('network')) })
      const { store } = setup(service)

      await store.getState().askHelp('What is the SLA?')

      expect(store.getState().help.entries[0]).toMatchObject({ status: 'error' })
      expect(store.getState().help.entries[0].error).toMatch(/reach the server/i)
    })

    it('can retry a failed question', async () => {
      const service = fakeService({
        askHelp: vi.fn().mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(helpAnswer),
      })
      const { store } = setup(service)
      await store.getState().askHelp('What is the SLA?')
      const [failed] = store.getState().help.entries

      await store.getState().retryHelp(failed.id)

      expect(store.getState().help.entries).toHaveLength(1)
      expect(store.getState().help.entries[0]).toMatchObject({ status: 'success', data: helpAnswer })
    })

    it('ignores a question shorter than 3 characters', async () => {
      const { store, service } = setup()

      await store.getState().askHelp('hi')
      await store.getState().askHelp('   ')

      expect(service.askHelp).not.toHaveBeenCalled()
      expect(store.getState().help.entries).toEqual([])
    })

    it('trims the question before sending it', async () => {
      const { store, service } = setup()

      await store.getState().askHelp('   What is the SLA?   ')

      expect(service.askHelp).toHaveBeenCalledWith('What is the SLA?', expect.anything())
    })
  })

  describe('chat streaming', () => {
    it('adds the user message and an empty streaming reply straight away', () => {
      const { store, service } = setup()
      liveStream(service)

      void store.getState().sendChat('talk', 'Which approval is first?')

      const chat = store.getState().chats.talk
      expect(chat.status).toBe('streaming')
      expect(chat.messages.map(m => [m.role, m.content, m.status])).toEqual([
        ['user', 'Which approval is first?', 'done'],
        ['assistant', '', 'streaming'],
      ])
    })

    it('appends each token as it arrives, then finishes on done', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)

      const pending = store.getState().sendChat('talk', 'Hi')
      channel.push({ type: 'token', text: 'Safety' })
      await flush()
      expect(store.getState().chats.talk.messages[1].content).toBe('Safety')

      channel.push({ type: 'token', text: ' specs first' })
      await flush()
      expect(store.getState().chats.talk.messages[1].content).toBe('Safety specs first')
      expect(store.getState().chats.talk.status).toBe('streaming')

      channel.push({ type: 'done' })
      await pending

      const chat = store.getState().chats.talk
      expect(chat.status).toBe('idle')
      expect(chat.messages[1]).toMatchObject({ content: 'Safety specs first', status: 'done' })
    })

    it('sends the mode and the conversation so far', async () => {
      const { store, service } = setup()
      const first = liveStream(service)
      const one = store.getState().sendChat('teach', 'How do I review a PDF?')
      first.push({ type: 'token', text: '1. Open it.' })
      first.push({ type: 'done' })
      await one

      const second = liveStream(service)
      const two = store.getState().sendChat('teach', 'Explain step 2 simpler')
      second.push({ type: 'done' })
      await two

      const [request] = service.streamChat.mock.calls[1] as [{ mode: string; messages: unknown[] }]
      expect(request.mode).toBe('teach')
      expect(request.messages).toEqual([
        { role: 'user', content: 'How do I review a PDF?' },
        { role: 'assistant', content: '1. Open it.' },
        { role: 'user', content: 'Explain step 2 simpler' },
      ])
    })

    it('keeps Talk and Teach conversations separate', async () => {
      const { store, service } = setup()
      const talk = liveStream(service)
      const pending = store.getState().sendChat('talk', 'Hello talk')
      talk.push({ type: 'done' })
      await pending

      expect(store.getState().chats.talk.messages).toHaveLength(2)
      expect(store.getState().chats.teach.messages).toHaveLength(0)
    })

    it('ignores empty messages', async () => {
      const { store, service } = setup()

      await store.getState().sendChat('talk', '   ')

      expect(service.streamChat).not.toHaveBeenCalled()
      expect(store.getState().chats.talk.messages).toEqual([])
    })

    it('ignores a second message while one is still streaming', () => {
      const { store, service } = setup()
      liveStream(service)

      void store.getState().sendChat('talk', 'First')
      void store.getState().sendChat('talk', 'Second')

      expect(service.streamChat).toHaveBeenCalledTimes(1)
      expect(store.getState().chats.talk.messages).toHaveLength(2)
    })
  })

  describe('chat failures', () => {
    it('shows the error event from the server and keeps the partial answer', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)

      const pending = store.getState().sendChat('talk', 'Hi')
      channel.push({ type: 'token', text: 'Partial' })
      channel.push({ type: 'error', message: 'Sorry, something went wrong.' })
      await pending

      const chat = store.getState().chats.talk
      expect(chat.status).toBe('error')
      expect(chat.error).toBe('Sorry, something went wrong.')
      expect(chat.messages[1]).toMatchObject({ content: 'Partial', status: 'error' })
    })

    it('removes the empty reply when the stream fails before any token', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)

      const pending = store.getState().sendChat('talk', 'Hi')
      channel.push({ type: 'error', message: 'Sorry, something went wrong.' })
      await pending

      const chat = store.getState().chats.talk
      expect(chat.messages.map(m => m.role)).toEqual(['user'])
      expect(chat.status).toBe('error')
    })

    it('turns a rate limit into a message with the wait time', async () => {
      const { store, service } = setup()
      service.streamChat.mockImplementation(() => {
        throw new ApiError('rate_limited', { retryAfterSeconds: 30 })
      })

      await store.getState().sendChat('talk', 'Hi')

      expect(store.getState().chats.talk.error).toMatch(/30/)
      expect(store.getState().chats.talk.status).toBe('error')
    })

    it('turns an unreachable server into a friendly message', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)

      const pending = store.getState().sendChat('talk', 'Hi')
      channel.fail(new ApiError('network'))
      await pending

      expect(store.getState().chats.talk.error).toMatch(/reach the server/i)
    })

    it('treats a stream that ends without done as an interruption', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)

      const pending = store.getState().sendChat('talk', 'Hi')
      channel.push({ type: 'token', text: 'Half an answ' })
      channel.end()
      await pending

      const chat = store.getState().chats.talk
      expect(chat.status).toBe('error')
      expect(chat.error).toMatch(/interrupted/i)
      expect(chat.messages[1].content).toBe('Half an answ')
    })

    it('can send again after an error', async () => {
      const { store, service } = setup()
      const failing = liveStream(service)
      const first = store.getState().sendChat('talk', 'Hi')
      failing.push({ type: 'error', message: 'Nope.' })
      await first

      const working = liveStream(service)
      const second = store.getState().sendChat('talk', 'Again')
      working.push({ type: 'token', text: 'Fine' })
      working.push({ type: 'done' })
      await second

      expect(store.getState().chats.talk.status).toBe('idle')
      expect(store.getState().chats.talk.error).toBeNull()
    })
  })

  describe('retry, stop and clear', () => {
    it('retry sends the same question again without duplicating it', async () => {
      const { store, service } = setup()
      const failing = liveStream(service)
      const first = store.getState().sendChat('talk', 'Which is first?')
      failing.push({ type: 'error', message: 'Nope.' })
      await first

      const working = liveStream(service)
      const retry = store.getState().retryChat('talk')
      working.push({ type: 'token', text: 'Safety specs.' })
      working.push({ type: 'done' })
      await retry

      const chat = store.getState().chats.talk
      expect(chat.messages.map(m => [m.role, m.content])).toEqual([
        ['user', 'Which is first?'],
        ['assistant', 'Safety specs.'],
      ])
      expect(chat.status).toBe('idle')
    })

    it('stop aborts the request and keeps what was received', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)
      const pending = store.getState().sendChat('talk', 'Hi')
      channel.push({ type: 'token', text: 'Part' })
      await flush()

      store.getState().stopChat('talk')
      await pending

      const signal = service.streamChat.mock.calls[0][1] as AbortSignal
      expect(signal.aborted).toBe(true)
      const chat = store.getState().chats.talk
      expect(chat.status).toBe('idle')
      expect(chat.error).toBeNull()
      expect(chat.messages[1]).toMatchObject({ content: 'Part', status: 'done' })
    })

    it('clear starts a fresh conversation', async () => {
      const { store, service } = setup()
      const channel = liveStream(service)
      const pending = store.getState().sendChat('teach', 'Hi')
      channel.push({ type: 'done' })
      await pending

      store.getState().clearChat('teach')

      expect(store.getState().chats.teach).toMatchObject({ messages: [], status: 'idle', error: null })
    })

    it('abortAll stops every request in flight', async () => {
      const { store, service } = setup()
      liveStream(service)
      const pending = store.getState().sendChat('talk', 'Hi')

      store.getState().abortAll()
      await pending

      expect((service.streamChat.mock.calls[0][1] as AbortSignal).aborted).toBe(true)
      expect(store.getState().chats.talk.status).toBe('idle')
    })
  })
})
