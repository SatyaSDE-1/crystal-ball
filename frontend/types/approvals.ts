export type ApprovalType = 'Folder' | 'Video' | 'PDF' | 'Image'

/** An approval as the backend (GET /api/approvals) returns it. */
export type ApiApproval = {
  id: string
  title: string
  type: ApprovalType
  submittedBy: string
  status: string
  submittedDate: string
}

/** An approval as the UI renders it. Plain data only, so it can cross from server to client components. */
export type Approval = {
  id: string
  title: string
  type: ApprovalType
  submitter: string
  initials: string
  color: string
  date: string
  status: string
  iconName: 'folder' | 'video' | 'file' | 'image'
}

export type ApprovalStats = {
  total: number
  pending: number
  approved: number
  rejected: number
}

/** What the server-side loader hands to a page. */
export type ApprovalsResult = {
  approvals: Approval[]
  /** true when the API could not be reached and sample data is shown instead */
  unavailable: boolean
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
