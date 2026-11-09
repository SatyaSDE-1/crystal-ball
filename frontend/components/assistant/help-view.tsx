'use client'

import { ArrowUp } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { HelpEntry } from '@/types/assistant'
import { useAssistant } from './assistant-provider'
import { RichText } from './rich-text'
import { ErrorAlert, Notice, Skeleton } from './status'

const MIN_LENGTH = 3
const SUGGESTIONS = [
  'What are the rejection criteria?',
  'When should I escalate an item?',
  'How fast must items be reviewed?',
]

/** "rejection-criteria" -> "Rejection criteria"; a short single word is an acronym: "sla" -> "SLA" */
function citationLabel(id: string): string {
  const words = id.replace(/-/g, ' ')
  if (!words.includes(' ') && words.length <= 3) return words.toUpperCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function Answer({ entry }: { entry: HelpEntry }) {
  const retryHelp = useAssistant(state => state.retryHelp)

  if (entry.status === 'loading') return <Skeleton label="Looking up the policy" lines={2} />
  if (entry.status === 'error' || !entry.data) {
    return <ErrorAlert message={entry.error ?? 'Something went wrong. Please try again.'} onRetry={() => void retryHelp(entry.id)} />
  }

  const { answer, citations, source } = entry.data
  return <div className="cb-answer">
    <RichText text={answer} />
    {citations.length > 0 && <div className="cb-sources">
      <span>Sources</span>
      {citations.map(id => <em key={id} className="cb-chip">{citationLabel(id)}</em>)}
    </div>}
    {source === 'fallback' && citations.length > 0 && <Notice>AI is unavailable right now, so this is the policy text itself.</Notice>}
    {source === 'fallback' && citations.length === 0 && <Notice>I can only answer from the approval policy note.</Notice>}
  </div>
}

export function HelpView() {
  const entries = useAssistant(state => state.help.entries)
  const askHelp = useAssistant(state => state.askHelp)
  const [question, setQuestion] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  const canAsk = question.trim().length >= MIN_LENGTH

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!canAsk) return
    void askHelp(question)
    setQuestion('')
  }

  return <div className="cb-help">
    <div className="cb-feed">
      {entries.length === 0 && <div className="cb-empty">
        <p>Ask about the approval policy: review order, rejection criteria, escalation, file rules or deadlines. Answers come only from the policy note.</p>
        <div className="cb-suggestions">
          {SUGGESTIONS.map(text => <button key={text} type="button" className="cb-suggestion" onClick={() => void askHelp(text)}>{text}</button>)}
        </div>
      </div>}

      {entries.map(entry => <div key={entry.id} className="cb-qa">
        <div className="cb-msg user"><div className="cb-bubble"><p>{entry.question}</p></div></div>
        <div className="cb-msg assistant"><div className="cb-bubble"><Answer entry={entry} /></div></div>
      </div>)}
      <div ref={endRef} />
    </div>

    <form className="cb-input" onSubmit={submit}>
      <input aria-label="Your question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about the approval policy…" autoComplete="off" />
      <button type="submit" disabled={!canAsk} aria-label="Ask"><ArrowUp size={16} aria-hidden="true" /></button>
    </form>
  </div>
}
