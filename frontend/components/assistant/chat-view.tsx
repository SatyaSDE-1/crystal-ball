'use client'

import { ArrowUp, Plus, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMode } from '@/lib/contracts'
import { useAssistant } from './assistant-provider'
import { RichText } from './rich-text'
import { ErrorAlert, TypingIndicator } from './status'

const COPY: Record<ChatMode, { intro: string; placeholder: string; starters: string[] }> = {
  talk: {
    intro: 'Ask me anything about the approvals in your queue.',
    placeholder: 'Ask about your approvals…',
    starters: ['Which approval needs my attention first and why?', 'What has Sam HelpAdmin submitted?'],
  },
  teach: {
    intro: 'I will walk you through reviewing and acting on an approval, one step at a time. Ask a follow-up any time and I will adapt.',
    placeholder: 'What would you like to learn?',
    starters: ['How do I review a PDF?', 'What should I check before approving a video?', 'How do I handle a safety-critical item?'],
  },
}

export function ChatView({ mode }: { mode: ChatMode }) {
  const chat = useAssistant(state => state.chats[mode])
  const sendChat = useAssistant(state => state.sendChat)
  const retryChat = useAssistant(state => state.retryChat)
  const stopChat = useAssistant(state => state.stopChat)
  const clearChat = useAssistant(state => state.clearChat)
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const streaming = chat.status === 'streaming'
  const copy = COPY[mode]

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.messages, chat.error])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!input.trim() || streaming) return
    void sendChat(mode, input)
    setInput('')
  }

  return <div className="cb-chat">
    {chat.messages.length > 0 && <div className="cb-chat-tools">
      <button type="button" className="cb-link-button" onClick={() => clearChat(mode)} disabled={streaming}><Plus size={13} aria-hidden="true" /> New conversation</button>
    </div>}

    <div className="cb-feed" role="log" aria-live="polite" aria-label="Conversation">
      {chat.messages.length === 0 && <div className="cb-empty">
        <p>{copy.intro}</p>
        <div className="cb-suggestions">
          {copy.starters.map(text => <button key={text} type="button" className="cb-suggestion" onClick={() => void sendChat(mode, text)}>{text}</button>)}
        </div>
      </div>}

      {chat.messages.map(message => {
        const waiting = message.role === 'assistant' && message.status === 'streaming' && message.content === ''
        return <div key={message.id} className={`cb-msg ${message.role}`}>
          <div className="cb-bubble">
            {waiting
              ? <TypingIndicator />
              : message.role === 'assistant'
                ? <RichText text={message.content} />
                : <p>{message.content}</p>}
            {message.status === 'streaming' && message.content !== '' && <span className="cb-cursor" aria-hidden="true" />}
          </div>
        </div>
      })}

      {chat.error && <ErrorAlert message={chat.error} onRetry={() => void retryChat(mode)} />}
      <div ref={endRef} />
    </div>

    <form className="cb-input" onSubmit={submit}>
      <input aria-label="Message" value={input} onChange={event => setInput(event.target.value)} placeholder={copy.placeholder} disabled={streaming} autoComplete="off" />
      {streaming
        ? <button type="button" className="stop" aria-label="Stop generating" onClick={() => stopChat(mode)}><Square size={13} aria-hidden="true" /></button>
        : <button type="submit" aria-label="Send message" disabled={!input.trim()}><ArrowUp size={16} aria-hidden="true" /></button>}
    </form>
  </div>
}
