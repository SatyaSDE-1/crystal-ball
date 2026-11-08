'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, BookOpen, Bot, ClipboardList, GraduationCap, MessageCircle, PanelRightClose, RefreshCw, Sparkles, X } from 'lucide-react'
import { assistantActions } from '@/fixtures/assistant-actions'
import { useAssistantStore } from '@/stores/assistant-store'
import { AssistantEmpty, AssistantError, AssistantLoading } from './assistant-state'

const icons = { clipboard: ClipboardList, message: MessageCircle, book: BookOpen, graduation: GraduationCap, refresh: RefreshCw }

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [started, setStarted] = useState(false)
  const { selectedActionId, messages, isStreaming, error, selectAction, sendMessage, resetError } = useAssistantStore()
  const selected = assistantActions.find(action => action.id === selectedActionId) ?? null

  if (minimized) return <button className="assistant-pill" onClick={() => setMinimized(false)}><span className="ai-orb small"><Bot size={17} /></span><span>Crystal Ball Assistant</span><span className="online-dot" /></button>

  const submit = async () => { if (!input.trim()) return; setStarted(true); const current = input; setInput(''); await sendMessage(current) }
  const SelectedIcon = selected ? icons[selected.iconName] : MessageCircle

  return <section className="assistant-panel" aria-label="Crystal Ball Assistant"><header className="assistant-header"><div className="ai-orb"><Sparkles size={18} /></div><div><b>Crystal Ball Assistant</b><span><i className="online-dot" /> Your operational intelligence assistant</span></div><button onClick={() => setMinimized(true)} aria-label="Minimize assistant"><PanelRightClose size={17} /></button><button onClick={onClose} aria-label="Close assistant"><X size={17} /></button></header>{!started && !selected ? <div className="assistant-welcome"><div className="greeting"><span className="wave">👋</span><div><b>Hello, Operator!</b><p>Welcome to your command centre. I&apos;m here to help you review approvals, understand operational policies, and guide you through your workflow.</p></div></div><div className="action-grid">{assistantActions.map(action => { const Icon = icons[action.iconName]; return <button className="action-card" key={action.id} onClick={() => { setStarted(true); void selectAction(action) }}><div className="action-icon"><Icon size={17} /></div><div><b>{action.label}</b><span>{action.description}</span></div><ArrowUpRight size={14} className="action-arrow" /></button> })}</div></div> : <div className="chat-mode"><button className="back-button" onClick={() => setStarted(false)}><ArrowLeft size={15} /> Back to actions</button><div className="chat-context"><span className="action-icon"><SelectedIcon size={15} /></span><span>Talking about <b>{selected?.label ?? 'your approval queue'}</b></span></div><div className="messages">{messages.length === 0 && <AssistantEmpty text="Ask a question or choose an action to begin." />}{messages.map(message => <div className={`message ${message.role}`} key={message.id}>{message.role === 'assistant' && <span className="ai-orb tiny"><Sparkles size={11} /></span>}<div>{message.text}</div></div>)}{isStreaming && <AssistantLoading />}{error && <AssistantError message={error} onRetry={resetError} />}</div><div className="chat-input"><input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) void submit() }} placeholder="Ask anything about approvals..." aria-label="Message assistant" /><button onClick={() => void submit()} aria-label="Send message"><ArrowUpRight size={16} /></button></div></div>}</section>
}
