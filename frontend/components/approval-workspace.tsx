'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, Filter, Search } from 'lucide-react'
import { ApprovalDetailsPanel } from '@/components/approval-details-panel'
import { ApprovalIcon } from '@/components/approval-icon'
import type { Approval } from '@/types/approvals'

const ALL_STATUSES = 'All statuses'

/**
 * Client island: the only part of the Approvals page that needs the browser
 * (search box, status filter, selecting a row). It receives the approvals the
 * server already loaded, so it renders with data on the first paint.
 */
export function ApprovalWorkspace({ approvals }: { approvals: Approval[] }) {
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [status, setStatus] = useState(ALL_STATUSES)
  const [selectedId, setSelectedId] = useState<string | undefined>(approvals[0]?.id)

  const statuses = useMemo(() => [ALL_STATUSES, ...new Set(approvals.map(a => a.status))], [approvals])
  const filtered = useMemo(
    () => approvals.filter(a =>
      a.title.toLowerCase().includes(search.toLowerCase()) && (status === ALL_STATUSES || a.status === status)),
    [approvals, search, status],
  )
  const selected = approvals.find(a => a.id === selectedId) ?? approvals[0]

  return <div className="approval-workspace-grid">
    <section className="queue-section queue-column">
      <div className="section-heading">
        <div><h2>Approval queue</h2><p>Items that require your review and decision.</p></div>
        <div className="queue-controls">
          <div className="search-field"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search approvals..." aria-label="Search approvals" /></div>
          <div className="filter-wrap">
            <button className="filter-button" onClick={() => setFilterOpen(!filterOpen)}><Filter size={15} /> {status}<ChevronDown size={14} /></button>
            {filterOpen && <div className="filter-menu">{statuses.map(option => <button key={option} onClick={() => { setStatus(option); setFilterOpen(false) }}><span className={status === option ? 'selected-dot' : ''} />{option}</button>)}</div>}
          </div>
        </div>
      </div>
      <div className="table-card">
        <div className="table-head"><span>ASSET</span><span>TYPE</span><span>SUBMITTED BY</span><span>STATUS</span><span>DATE</span><span /></div>
        {filtered.map(approval => <div className="table-row" key={approval.id}>
          <div className="asset-cell"><div className="asset-icon"><ApprovalIcon name={approval.iconName} size={18} /></div><div><b>{approval.title}</b><span>Operational asset</span></div></div>
          <span className="type-cell">{approval.type}</span>
          <span className="submitter"><i className={`avatar avatar-small ${approval.color}`}>{approval.initials}</i>{approval.submitter}</span>
          <span><em className="status-badge"><span /> {approval.status}</em></span>
          <span className="date-cell">{approval.date}</span>
          <button className="view-button" onClick={() => setSelectedId(approval.id)}>Review <ArrowUpRight size={14} /></button>
        </div>)}
        {filtered.length === 0 && <div className="empty-state"><Search size={24} /><b>No approvals found</b><span>Try a different search term.</span></div>}
        <div className="table-footer"><span>Showing {filtered.length} of {approvals.length} approvals</span><div><button disabled>Previous</button><button className="current">1</button><button disabled>Next</button></div></div>
      </div>
    </section>
    {selected && <div className="approval-details-wrap"><ApprovalDetailsPanel approval={selected} /></div>}
  </div>
}
