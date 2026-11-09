'use client'

import Link from 'next/link'
import { Plus, UploadCloud } from 'lucide-react'

/**
 * Client island: the one interactive piece of the "New approval" page.
 * This is a frontend prototype, so submitting does not send anything yet.
 */
export function NewApprovalForm() {
  return <form className="action-card" onSubmit={event => event.preventDefault()}>
    <label>Asset name<input placeholder="e.g. Northstar site walkthrough" /></label>
    <label>Asset type<select defaultValue="Folder"><option>Folder</option><option>Video</option><option>PDF</option><option>Image</option></select></label>
    <label>Review notes<textarea placeholder="Add context for the reviewer..." rows={5} /></label>
    <div className="upload-zone"><UploadCloud size={22} /><b>Attach operational material</b><span>Drag and drop a file, or choose one from your workspace.</span><button type="button" className="secondary-action">Choose file</button></div>
    <div className="action-footer"><Link href="/" className="secondary-action">Cancel</Link><button className="primary-action" type="submit"><Plus size={15} /> Create approval</button></div>
  </form>
}
