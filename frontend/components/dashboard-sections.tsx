import Link from 'next/link'
import { Bell, CheckCircle2, ClipboardList, Clock3, Filter, Menu, Plus, Search, XCircle } from 'lucide-react'
import type { ApprovalStats } from '@/types/approvals'

/**
 * The static parts of the Approvals page. Server components: they render to
 * HTML on the server, and their numbers come from the data the page loaded.
 */

export function Topbar() {
  return <header className="topbar">
    <button className="mobile-menu" aria-label="Open navigation"><Menu size={20} /></button>
    <div className="breadcrumbs"><span>Dashboard</span><span>/</span><b>Approvals</b></div>
    <div className="top-actions"><button className="icon-button"><Search size={18} /></button><button className="icon-button notification"><Bell size={18} /><i /></button><div className="top-avatar">JD</div></div>
  </header>
}

export function PageHeading() {
  return <div className="page-heading">
    <div><div className="eyebrow">OPERATIONS / WORKFLOW</div><h1>Approvals</h1><p>Review and manage pending operational approvals.</p></div>
    <div className="heading-actions">
      <Link href="/approvals/export" className="button secondary"><Filter size={15} /> Export queue</Link>
      <Link href="/approvals/new" className="button primary"><Plus size={16} /> New approval</Link>
    </div>
  </div>
}

type StatCardProps = { label: string; value: number; icon: typeof Clock3; tone: string; note: string }

function StatCard({ label, value, icon: Icon, tone, note }: StatCardProps) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={17} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong></div><small>{note}</small></div>
}

export function StatsGrid({ stats }: { stats: ApprovalStats }) {
  return <div className="stats-grid">
    <StatCard label="Total Approvals" value={stats.total} icon={ClipboardList} tone="blue" note="All time" />
    <StatCard label="Pending Review" value={stats.pending} icon={Clock3} tone="amber" note="Needs attention" />
    <StatCard label="Approved" value={stats.approved} icon={CheckCircle2} tone="green" note="This month" />
    <StatCard label="Rejected" value={stats.rejected} icon={XCircle} tone="rose" note="This month" />
  </div>
}

/** Shown when the API could not be reached and sample data is displayed instead. */
export function ApiUnavailableNotice() {
  return <div className="api-notice" role="status">
    Couldn&apos;t reach the approvals API, so sample data is shown. Start the gateway on port 4000 and refresh.
  </div>
}
