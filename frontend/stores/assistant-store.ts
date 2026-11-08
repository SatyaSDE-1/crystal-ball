'use client'

import { create } from 'zustand'
import type { AssistantAction, AssistantActionId, AssistantState, ChatMessage } from '@/types/approvals'
import { assistantService } from '@/services/assistant-service'

const message = (role: ChatMessage['role'], text: string, isStreaming = false): ChatMessage => ({ id: `${Date.now()}-${Math.random()}`, role, text, isStreaming })

type AssistantStore = AssistantState & {
  selectAction: (action: AssistantAction) => void
  sendMessage: (input: string) => Promise<void>
  resetError: () => void
}

export const useAssistantStore = create<AssistantStore>((set, get) => ({
  selectedActionId: null,
  messages: [],
  isStreaming: false,
  error: null,
  selectAction: async action => {
    const response = await assistantService.respond('', action)
    const assistantMessage = message('assistant', '')
    set(state => ({ selectedActionId: action.id, messages: [...state.messages, assistantMessage], isStreaming: true, error: null }))
    await assistantService.stream(response.text, partial => set(state => ({ messages: state.messages.map(item => item.id === assistantMessage.id ? { ...item, text: partial } : item) })))
    set(state => ({ messages: state.messages.map(item => item.id === assistantMessage.id ? { ...item, isStreaming: false } : item), isStreaming: false }))
  },
  sendMessage: async input => {
    const trimmed = input.trim()
    if (!trimmed || get().isStreaming) return
    const userMessage = message('user', trimmed)
    const assistantMessage = message('assistant', '', true)
    set(state => ({ messages: [...state.messages, userMessage, assistantMessage], isStreaming: true, error: null }))
    try {
      const action = get().selectedActionId
      const response = await assistantService.respond(trimmed, action ? null : null)
      await assistantService.stream(response.text, partial => set(state => ({ messages: state.messages.map(item => item.id === assistantMessage.id ? { ...item, text: partial } : item) })))
      set(state => ({ messages: state.messages.map(item => item.id === assistantMessage.id ? { ...item, isStreaming: false } : item), isStreaming: false }))
    } catch {
      set({ error: 'The assistant could not respond. Please try again.', isStreaming: false })
    }
  },
  resetError: () => set({ error: null }),
}))

export const selectActionId = (state: AssistantState): AssistantActionId | null => state.selectedActionId
