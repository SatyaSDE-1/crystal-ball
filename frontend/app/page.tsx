import { ApiUnavailableNotice, PageHeading, StatsGrid, Topbar } from '@/components/dashboard-sections'
import { ApprovalWorkspace } from '@/components/approval-workspace'
import { AssistantLayer } from '@/components/assistant-layer'
import { Sidebar } from '@/components/sidebar'
import { getApprovals } from '@/lib/api'
import { statsOf } from '@/lib/approvals'

// Server-side rendered on every request (the App Router equivalent of
// getServerSideProps): the approvals are fetched from the API here, on the
// server, and arrive in the browser already rendered into the HTML.
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { approvals, unavailable } = await getApprovals()
  const stats = statsOf(approvals)

  return <div className="app-shell">
    <Sidebar active="Approvals" pendingCount={stats.pending} />
    <main className="main-content">
      <Topbar />
      <div className="page-wrap">
        <PageHeading />
        {unavailable && <ApiUnavailableNotice />}
        <StatsGrid stats={stats} />
        <ApprovalWorkspace approvals={approvals} />
      </div>
    </main>
    <AssistantLayer approvals={approvals} />
  </div>
}
