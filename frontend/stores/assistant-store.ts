import { createStore } from 'zustand/vanilla'
import { statsOf } from '@/lib/approvals'
import type { ChatMode, ChatTurn } from '@/lib/contracts'
import { describeError, isAbortError } from '@/lib/errors'
import type { AssistantService } from '@/services/assistant-service'
import type { Approval } from '@/types/approvals'
import type {
  AssistantView,
  ChatMessage,
  ChatState,
  GreetingState,
  HelpEntry,
  SummaryState,
} from '@/types/assistant'

/** The API rejects shorter questions, so they are not sent at all. */
const MIN_QUESTION_LENGTH = 3

export type AssistantStore = {
  view: AssistantView
  approvals: Approval[]
  greeting: GreetingState
  summary: SummaryState
  help: { entries: HelpEntry[] }
  chats: Record<ChatMode, ChatState>

  setApprovals: (approvals: Approval[]) => void
  openView: (view: AssistantView) => void
  goHome: () => void
  loadGreeting: (force?: boolean) => Promise<void>
  replayGreeting: () => Promise<void>
  loadSummary: (force?: boolean) => Promise<void>
  askHelp: (question: string) => Promise<void>
  retryHelp: (id: string) => Promise<void>
  sendChat: (mode: ChatMode, text: string) => Promise<void>
  retryChat: (mode: ChatMode) => Promise<void>
  stopChat: (mode: ChatMode) => void
  clearChat: (mode: ChatMode) => void
  abortAll: () => void
}

const emptyChat = (): ChatState => ({ messages: [], status: 'idle', error: null })

/** Used when the API cannot be reached at all, so the panel never opens empty. */
export function fallbackGreeting(pending: number): string {
  if (pending === 0) return 'Hello, Operator! You have no approvals pending.'
  return `Hello, Operator! You have ${pending} ${pending === 1 ? 'approval' : 'approvals'} pending.`
}

/**
 * The conversation to send: only exchanges that were answered in full. A
 * question whose answer failed is left out, so a retry or a new question
 * does not confuse the model with a half-finished turn.
 */
function toRequestTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i]
    const next = messages[i + 1]
    if (current.role === 'user' && next.role === 'assistant' && next.status === 'done' && next.content) {
      turns.push({ role: 'user', content: current.content }, { role: 'assistant', content: next.content })
    }
  }
  return turns
}

let nextId = 0
const newId = (prefix: string) => `${prefix}-${++nextId}`

/**
 * All assistant state in one place, so no component passes props down or
 * owns request logic. The service is injected: the app gives it the real
 * API client, tests give it a fake.
 */
export function createAssistantStore(service: AssistantService) {
  const controllers = new Map<string, AbortController>()
  let greetingTicket = 0

  const track = (key: string) => {
    controllers.get(key)?.abort()
    const controller = new AbortController()
    controllers.set(key, controller)
    return controller
  }

  return createStore<AssistantStore>()((set, get) => {
    const patchChat = (mode: ChatMode, patch: Partial<ChatState>) =>
      set(state => ({ chats: { ...state.chats, [mode]: { ...state.chats[mode], ...patch } } }))

    const patchMessage = (mode: ChatMode, id: string, patch: Partial<ChatMessage>) =>
      set(state => ({
        chats: {
          ...state.chats,
          [mode]: {
            ...state.chats[mode],
            messages: state.chats[mode].messages.map(m => (m.id === id ? { ...m, ...patch } : m)),
          },
        },
      }))

    const patchHelp = (id: string, patch: Partial<HelpEntry>) =>
      set(state => ({
        help: { entries: state.help.entries.map(e => (e.id === id ? { ...e, ...patch } : e)) },
      }))

    const runHelp = async (id: string, question: string) => {
      const controller = track(`help-${id}`)
      try {
        const data = await service.askHelp(question, controller.signal)
        patchHelp(id, { status: 'success', data, error: null })
      } catch (error) {
        if (isAbortError(error)) return
        patchHelp(id, { status: 'error', data: null, error: describeError(error) })
      }
    }

    /** Ends a chat turn in error, keeping any partial answer that was already shown. */
    const failChat = (mode: ChatMode, assistantId: string, message: string) => {
      set(state => {
        const chat = state.chats[mode]
        const reply = chat.messages.find(m => m.id === assistantId)
        const messages = reply && reply.content === ''
          ? chat.messages.filter(m => m.id !== assistantId)
          : chat.messages.map(m => (m.id === assistantId ? { ...m, status: 'error' as const } : m))
        return { chats: { ...state.chats, [mode]: { messages, status: 'error', error: message } } }
      })
    }

    /** The user stopped the stream: keep what arrived, no error. */
    const stopChatTurn = (mode: ChatMode, assistantId: string) => {
      set(state => {
        const chat = state.chats[mode]
        const reply = chat.messages.find(m => m.id === assistantId)
        const messages = reply && reply.content === ''
          ? chat.messages.filter(m => m.id !== assistantId)
          : chat.messages.map(m => (m.id === assistantId ? { ...m, status: 'done' as const } : m))
        return { chats: { ...state.chats, [mode]: { messages, status: 'idle', error: null } } }
      })
    }

    return {
      view: 'home',
      approvals: [],
      greeting: { status: 'idle', text: '', source: null },
      summary: { status: 'idle', data: null, error: null },
      help: { entries: [] },
      chats: { talk: emptyChat(), teach: emptyChat() },

      setApprovals: approvals => set({ approvals }),

      openView: view => {
        set({ view })
        if (view === 'summary') void get().loadSummary()
      },

      goHome: () => set({ view: 'home' }),

      loadGreeting: async (force = false) => {
        const { greeting } = get()
        if (!force && (greeting.status === 'loading' || greeting.status === 'success')) return

        const ticket = ++greetingTicket
        const controller = track('greeting')
        // keep any greeting already on screen while the new one loads
        set({ greeting: { ...greeting, status: 'loading' } })

        try {
          const data = await service.getGreeting(controller.signal)
          if (ticket !== greetingTicket) return
          set({ greeting: { status: 'success', text: data.text, source: data.source } })
        } catch (error) {
          if (ticket !== greetingTicket || isAbortError(error)) return
          const pending = statsOf(get().approvals).pending
          set({ greeting: { status: 'success', text: fallbackGreeting(pending), source: 'fallback' } })
        }
      },

      replayGreeting: () => get().loadGreeting(true),

      loadSummary: async (force = false) => {
        const { summary } = get()
        if (!force && (summary.status === 'loading' || summary.status === 'success')) return

        const controller = track('summary')
        set({ summary: { status: 'loading', data: force ? null : summary.data, error: null } })

        try {
          const data = await service.getSummary(controller.signal)
          set({ summary: { status: 'success', data, error: null } })
        } catch (error) {
          if (isAbortError(error)) {
            set({ summary: { status: 'idle', data: null, error: null } })
            return
          }
          set({ summary: { status: 'error', data: null, error: describeError(error) } })
        }
      },

      askHelp: async question => {
        const trimmed = question.trim()
        if (trimmed.length < MIN_QUESTION_LENGTH) return

        const entry: HelpEntry = { id: newId('help'), question: trimmed, status: 'loading', data: null, error: null }
        set(state => ({ help: { entries: [...state.help.entries, entry] } }))
        await runHelp(entry.id, trimmed)
      },

      retryHelp: async id => {
        const entry = get().help.entries.find(e => e.id === id)
        if (!entry || entry.status === 'loading') return

        patchHelp(id, { status: 'loading', data: null, error: null })
        await runHelp(id, entry.question)
      },

      sendChat: async (mode, text) => {
        const input = text.trim()
        const chat = get().chats[mode]
        if (!input || chat.status === 'streaming') return

        const turns = toRequestTurns(chat.messages)
        const userMessage: ChatMessage = { id: newId('msg'), role: 'user', content: input, status: 'done' }
        const reply: ChatMessage = { id: newId('msg'), role: 'assistant', content: '', status: 'streaming' }
        patchChat(mode, { messages: [...chat.messages, userMessage, reply], status: 'streaming', error: null })

        const controller = track(mode)
        let finished = false

        try {
          const stream = service.streamChat(
            { mode, messages: [...turns, { role: 'user', content: input }] },
            controller.signal,
          )

          for await (const event of stream) {
            if (event.type === 'token') {
              set(state => ({
                chats: {
                  ...state.chats,
                  [mode]: {
                    ...state.chats[mode],
                    messages: state.chats[mode].messages.map(m =>
                      m.id === reply.id ? { ...m, content: m.content + event.text } : m),
                  },
                },
              }))
            } else if (event.type === 'done') {
              finished = true
              patchMessage(mode, reply.id, { status: 'done' })
              patchChat(mode, { status: 'idle', error: null })
              break
            } else {
              failChat(mode, reply.id, event.message)
              return
            }
          }

          if (!finished) {
            failChat(mode, reply.id, 'The response was interrupted. Please try again.')
          }
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) {
            stopChatTurn(mode, reply.id)
            return
          }
          failChat(mode, reply.id, describeError(error))
        }
      },

      retryChat: async mode => {
        const chat = get().chats[mode]
        if (chat.status === 'streaming') return

        const lastUser = [...chat.messages].reverse().find(m => m.role === 'user')
        if (!lastUser) return

        // drop the failed exchange, then ask the same question again
        const index = chat.messages.findIndex(m => m.id === lastUser.id)
        patchChat(mode, { messages: chat.messages.slice(0, index), status: 'idle', error: null })
        await get().sendChat(mode, lastUser.content)
      },

      stopChat: mode => controllers.get(mode)?.abort(),

      clearChat: mode => {
        controllers.get(mode)?.abort()
        patchChat(mode, emptyChat())
      },

      abortAll: () => {
        for (const controller of controllers.values()) controller.abort()
      },
    }
  })
}
