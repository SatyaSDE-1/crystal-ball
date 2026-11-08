import type { AssistantAction } from '@/types/approvals'

export const assistantActions: AssistantAction[] = [
  { id: 'summary', label: 'Present me Summary', description: 'Get an intelligent overview of pending approvals.', iconName: 'clipboard', response: 'You have 4 approvals waiting for review. All were submitted on September 18, and none have been actioned yet. The oldest item is the Site Patrol Onboarding & Checklists.' },
  { id: 'talk', label: 'Talk to me', description: 'Ask questions about your approval queue.', iconName: 'message', response: 'I’m ready. Ask me about the approval queue, a specific asset, or what needs your attention next.' },
  { id: 'help', label: 'Help me', description: 'Get answers about approval policies and procedures.', iconName: 'book', response: 'I can help explain your approval workflow. Review the asset details, confirm the operational context, then choose Approve or Request changes.' },
  { id: 'teach', label: 'Teach me', description: 'Learn how to review and manage approvals.', iconName: 'graduation', response: 'Start with the queue. Open an item to inspect its details, check the submitter and asset type, then make a decision with a clear audit trail.' },
  { id: 'greeting', label: 'Replay Greeting', description: 'Generate a fresh personalized greeting.', iconName: 'refresh', response: 'Welcome back, Operator. Your command centre is ready and 4 approvals are waiting for your review.' },
]
