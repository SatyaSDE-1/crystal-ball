'use client'

import Link from 'next/link'
import { ArrowLeft, Download, FileText, Plus, UploadCloud } from 'lucide-react'

type Mode = 'new' | 'export'

export function ApprovalActionPage({ mode }: { mode: Mode }) {
  const isNew = mode === 'new'
  return (
    <main className="action-page">
      <div className="action-page-inner">
        <Link href="/" className="action-back"><ArrowLeft size={16} /> Back to approvals</Link>
        <div className="action-hero">
          <div className="action-icon">{isNew ? <Plus size={22} /> : <Download size={22} />}</div>
          <div><p className="eyebrow">APPROVALS / WORKFLOW</p><h1>{isNew ? 'New approval' : 'Export approval queue'}</h1><p>{isNew ? 'Submit an operational asset for review and decision.' : 'Download a clean snapshot of the current approval queue.'}</p></div>
        </div>
        {isNew ? <form className="action-card" onSubmit={(event) => event.preventDefault()}>
          <label>Asset name<input placeholder="e.g. Northstar site walkthrough" /></label>
          <label>Asset type<select defaultValue="Folder"><option>Folder</option><option>Video</option><option>PDF</option><option>Image</option></select></label>
          <label>Review notes<textarea placeholder="Add context for the reviewer..." rows={5} /></label>
          <div className="upload-zone"><UploadCloud size={22} /><b>Attach operational material</b><span>Drag and drop a file, or choose one from your workspace.</span><button type="button" className="secondary-action">Choose file</button></div>
          <div className="action-footer"><Link href="/" className="secondary-action">Cancel</Link><button className="primary-action" type="submit"><Plus size={15} /> Create approval</button></div>
        </form> : <section className="action-card export-card"><div className="export-file"><div className="action-icon"><FileText size={20} /></div><div><b>Approval queue export</b><span>4 records · Pending review · CSV format</span></div></div><p>The export contains approval titles, asset types, submitters, dates, and current statuses. This is a frontend prototype; no file is uploaded or sent to a backend.</p><div className="action-footer"><Link href="/" className="secondary-action">Cancel</Link><button className="primary-action" type="button"><Download size={15} /> Download CSV</button></div></section>}
      </div>
    </main>
  )
}
