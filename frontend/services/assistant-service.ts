import type { AssistantAction, ChatMessage } from '@/types/approvals'

export type AssistantResponse = { text: string }

export interface AssistantService {
  respond(input: string, action: AssistantAction | null): Promise<AssistantResponse>
  stream(text: string, onToken: (partial: string) => void): Promise<void>
}

const mockAssistantService: AssistantService = {
  async respond(input, action) {
    if (action) return { text: action.response }
    return { text: `I’ll look into “${input}” for you. Based on the current queue, I recommend starting with the oldest pending item and recording your decision in the review panel.` }
  },
  async stream(text, onToken) {
    let partial = ''
    for (const token of text.split(/(\s+)/)) {
      partial += token
      onToken(partial)
      await new Promise(resolve => setTimeout(resolve, 18))
    }
  },
}

export const assistantService = mockAssistantService
export type AssistantHistory = ChatMessage[]
