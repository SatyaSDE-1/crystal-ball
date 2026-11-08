export type Approval = {
  title: string
  type: 'Folder' | 'Video' | 'PDF' | 'Image'
  submitter: string
  initials: string
  color: string
  date: string
  iconName: 'folder' | 'video' | 'file' | 'image'
}

export type ChatRole = 'assistant' | 'user'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  isStreaming?: boolean
}

export type AssistantActionId = 'summary' | 'talk' | 'help' | 'teach' | 'greeting'

export type AssistantAction = {
  id: AssistantActionId
  label: string
  description: string
  response: string
  iconName: 'clipboard' | 'message' | 'book' | 'graduation' | 'refresh'
}

export type AssistantState = {
  selectedActionId: AssistantActionId | null
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
}
