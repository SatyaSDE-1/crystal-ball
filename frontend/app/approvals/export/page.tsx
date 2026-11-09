import { ApprovalActionPage } from '@/components/approval-action-page'
import { getApprovals } from '@/lib/api'

// Static page that refreshes itself at most once a minute (the App Router
// equivalent of getStaticProps with `revalidate`, i.e. ISR).
export const revalidate = 60

export default async function ExportQueuePage() {
  const { approvals } = await getApprovals({ revalidate })
  return <ApprovalActionPage mode="export" recordCount={approvals.length} />
}
