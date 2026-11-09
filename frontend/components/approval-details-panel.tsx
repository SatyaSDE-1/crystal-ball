'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle2, FileText, UserRound } from 'lucide-react'
import { ApprovalIcon } from '@/components/approval-icon'
import type { Approval } from '@/types/approvals'

export function ApprovalDetailsPanel({ approval }: { approval: Approval }) {
  const [tab, setTab] = useState<'snapshot' | 'media'>('snapshot')

  return <aside className="approval-details-panel" aria-label="Approval details">
    <div className="details-breadcrumb"><span>My Site Patrol</span><b>›</b><span>My Site Patrol Card</span><b>›</b><strong>{approval.title}</strong></div>
    <div className="details-title-row"><div><div className="eyebrow">SELECTED APPROVAL</div><h2>{approval.title}</h2></div><span className="asset-type-badge"><ApprovalIcon name={approval.iconName} size={13} /> {approval.type}</span></div>
    <div className="details-meta-grid"><div><UserRound size={14} /><span>Submitted by</span><b>{approval.submitter}</b></div><div><CalendarDays size={14} /><span>Submitted</span><b>{approval.date}, 2024</b></div><div><CheckCircle2 size={14} /><span>Status</span><b className="status-text">{approval.status}</b></div></div>
    <p className="details-description">This operational asset is ready for review. Inspect the attached material and confirm it meets your site and safety requirements.</p>
    <div className="details-tabs" role="tablist"><button className={tab === 'snapshot' ? 'active' : ''} onClick={() => setTab('snapshot')} role="tab" aria-selected={tab === 'snapshot'}>Snapshot &amp; Control</button><button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')} role="tab" aria-selected={tab === 'media'}>Media / Content</button></div>
    {tab === 'snapshot' ? <div className="snapshot-content"><div className="snapshot-heading"><div><div className="eyebrow">OPERATIONAL PREVIEW</div><h3>Screen Snapshot Target</h3></div><span className="live-badge">Preview</span></div><div className="snapshot-frame"><div className="snapshot-ambient" /><div className="snapshot-window"><div className="snapshot-window-bar"><span /><span /><span /><b>{approval.title}</b></div><div className="snapshot-placeholder"><ApprovalIcon name={approval.iconName} size={42} /><strong>{approval.title}</strong><span>{approval.type} asset preview</span></div></div><span className="snapshot-overlay">{approval.title}</span></div><p className="snapshot-caption">A polished operational preview is shown here when an asset has a captured screen snapshot.</p></div> : <div className="media-content"><div className="media-file-card"><div className="media-file-icon"><ApprovalIcon name={approval.iconName} size={25} /></div><div><span>{approval.type} file</span><strong>{approval.title}</strong><small>Uploaded by {approval.submitter} · {approval.date}, 2024</small></div></div><div className="media-preview"><FileText size={25} /><span>Mock file preview</span><small>No source file is connected in this frontend prototype.</small></div><div className="media-info"><span>File description</span><p>Supporting material for the My Site Patrol operational workflow.</p></div></div>}
  </aside>
}
