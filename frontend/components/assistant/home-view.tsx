'use client'

import { BookOpen, ClipboardList, GraduationCap, MessageCircle, type LucideIcon } from 'lucide-react'
import type { AssistantView } from '@/types/assistant'
import { useAssistant } from './assistant-provider'
import { Skeleton } from './status'

const ACTIONS: { view: Exclude<AssistantView, 'home'>; label: string; description: string; icon: LucideIcon; tone: string }[] = [
  { view: 'summary', label: 'Present me Summary', description: 'Get an intelligent overview of pending approvals.', icon: ClipboardList, tone: 'amber' },
  { view: 'talk', label: 'Talk to me', description: 'Ask questions about your approval queue.', icon: MessageCircle, tone: 'blue' },
  { view: 'help', label: 'Help me', description: 'Get answers about approval policies and procedures.', icon: BookOpen, tone: 'violet' },
  { view: 'teach', label: 'Teach me', description: 'Learn how to review and manage approvals.', icon: GraduationCap, tone: 'green' },
]

export function HomeView() {
  const greeting = useAssistant(state => state.greeting)
  const openView = useAssistant(state => state.openView)

  const waiting = greeting.text === ''

  return <div className="cb-home">
    <div className="cb-greeting" aria-busy={greeting.status === 'loading'}>
      <span className="cb-wave" aria-hidden="true">👋</span>
      <div>
        {waiting
          ? <Skeleton label="Loading greeting" lines={2} />
          : <p className={greeting.status === 'loading' ? 'cb-refreshing' : undefined}>{greeting.text}</p>}
        {greeting.source === 'fallback' && <span className="cb-badge">Basic greeting · AI unavailable</span>}
      </div>
    </div>

    <div className="cb-grid">
      {ACTIONS.map(({ view, label, description, icon: Icon, tone }) =>
        <button key={view} type="button" className="cb-card" data-tone={tone} onClick={() => openView(view)}>
          <span className="cb-card-icon"><Icon size={26} aria-hidden="true" /></span>
          <b>{label}</b>
          <small>{description}</small>
        </button>)}
    </div>
  </div>
}
