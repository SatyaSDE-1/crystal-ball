import type { ChatMode, HelpResponse, Source, SummaryResponse } from '@/lib/contracts'

export type AssistantView = 'home' | 'summary' | 'help' | ChatMode

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'

export type GreetingState = {
  status: LoadStatus
  text: string
  /** where the text came from; "fallback" also covers the local greeting used when the API is unreachable */
  source: Source | null
}

export type SummaryState = {
  status: LoadStatus
  data: SummaryResponse | null
  error: string | null
}

export type HelpEntry = {
  id: string
  question: string
  status: 'loading' | 'success' | 'error'
  data: HelpResponse | null
  error: string | null
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'streaming' | 'done' | 'error'
}

export type ChatState = {
  messages: ChatMessage[]
  status: 'idle' | 'streaming' | 'error'
  error: string | null
}
