'use client'

import { RefreshCw } from 'lucide-react'
import { useAssistant } from './assistant-provider'
import { ErrorAlert, Notice, Skeleton } from './status'

const LABEL = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' } as const

export function SummaryView() {
  const { status, data, error } = useAssistant(state => state.summary)
  const approvals = useAssistant(state => state.approvals)
  const loadSummary = useAssistant(state => state.loadSummary)

  if (status === 'error' && error) {
    return <ErrorAlert message={error} onRetry={() => void loadSummary(true)} />
  }
  if (!data) {
    return <Skeleton label="Loading summary" lines={4} />
  }

  const titles = new Map(approvals.map(approval => [approval.id, approval.title]))

  return <div className="cb-summary">
    <p className="cb-headline">{data.headline}</p>
    {data.source === 'ai'
      ? <span className="cb-badge ai">AI summary</span>
      : <Notice>AI is unavailable right now, so this is a basic ranking by content and type.</Notice>}

    <ul className="cb-summary-list">
      {data.items.map(item =>
        <li key={item.id}>
          <div className="cb-summary-top">
            <b>{titles.get(item.id) ?? item.id}</b>
            <span className={`cb-urgency ${item.urgency}`}>{LABEL[item.urgency]}</span>
          </div>
          <p>{item.reason}</p>
        </li>)}
    </ul>

    <button type="button" className="cb-link-button" onClick={() => void loadSummary(true)} disabled={status === 'loading'}>
      <RefreshCw size={13} aria-hidden="true" /> {status === 'loading' ? 'Refreshing…' : 'Refresh summary'}
    </button>
  </div>
}
