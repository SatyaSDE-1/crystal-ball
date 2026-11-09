import Link from 'next/link'
import { ArrowLeft, Download, FileText, Plus } from 'lucide-react'
import { NewApprovalForm } from '@/components/new-approval-form'

type Mode = 'new' | 'export'

/**
 * Server component. The "New approval" form is the only interactive part, so
 * it is the only client island here (NewApprovalForm).
 */
export function ApprovalActionPage({ mode, recordCount }: { mode: Mode; recordCount?: number }) {
  const isNew = mode === 'new'
  return (
    <main className="action-page">
      <div className="action-page-inner">
        <Link href="/" className="action-back"><ArrowLeft size={16} /> Back to approvals</Link>
        <div className="action-hero">
          <div className="action-icon">{isNew ? <Plus size={22} /> : <Download size={22} />}</div>
          <div><p className="eyebrow">APPROVALS / WORKFLOW</p><h1>{isNew ? 'New approval' : 'Export approval queue'}</h1><p>{isNew ? 'Submit an operational asset for review and decision.' : 'Download a clean snapshot of the current approval queue.'}</p></div>
        </div>
        {isNew ? <NewApprovalForm /> : <section className="action-card export-card"><div className="export-file"><div className="action-icon"><FileText size={20} /></div><div><b>Approval queue export</b><span>{recordCount ?? 0} {recordCount === 1 ? 'record' : 'records'} · Pending review · CSV format</span></div></div><p>The export contains approval titles, asset types, submitters, dates, and current statuses. This is a frontend prototype; no file is uploaded or sent to a backend.</p><div className="action-footer"><Link href="/" className="secondary-action">Cancel</Link><button className="primary-action" type="button"><Download size={15} /> Download CSV</button></div></section>}
      </div>
    </main>
  )
}
