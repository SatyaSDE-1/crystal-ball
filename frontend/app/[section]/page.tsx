import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { getApprovals } from '@/lib/api'
import { statsOf } from '@/lib/approvals'

const pageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: 'COMMAND CENTRE', title: 'Dashboard', description: 'A live overview of your operational workspace.' },
  'digital-twin': { eyebrow: 'OPERATIONS / DIGITAL TWIN', title: 'Digital Twin', description: 'Explore a connected view of your sites, people, and assets.' },
  'sites-assets': { eyebrow: 'OPERATIONS / INVENTORY', title: 'Sites & Assets', description: 'Manage operational sites and the assets assigned to them.' },
  monitoring: { eyebrow: 'OPERATIONS / SIGNALS', title: 'Monitoring', description: 'Track live operational signals and events across your estate.' },
  reports: { eyebrow: 'OPERATIONS / INSIGHTS', title: 'Reports', description: 'Turn operational activity into clear, actionable reporting.' },
  settings: { eyebrow: 'SYSTEM', title: 'Settings', description: 'Configure your workspace, notifications, and access controls.' },
}

// Built ahead of time (the App Router equivalent of getStaticPaths): one
// static page per known section.
export function generateStaticParams() {
  return Object.keys(pageCopy).map(section => ({ section }))
}

// Like getStaticPaths with `fallback: false`: any other path, such as the
// removed /login, answers 404 instead of a generic placeholder page.
export const dynamicParams = false

// Static pages refresh at most once a minute (getStaticProps with `revalidate`, i.e. ISR),
// so the Approvals badge in the sidebar stays reasonably current.
export const revalidate = 60

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  const { approvals } = await getApprovals({ revalidate })
  const content = pageCopy[section]
  if (!content) notFound()
  return <div className="app-shell"><Sidebar active={content.title} pendingCount={statsOf(approvals).pending} /><main className="main-content"><header className="topbar"><div className="breadcrumbs"><Link href="/">Dashboard</Link><span>/</span><b>{content.title}</b></div><div className="top-actions"><div className="top-avatar">JD</div></div></header><div className="page-wrap section-placeholder"><div className="eyebrow">{content.eyebrow}</div><h1>{content.title}</h1><p>{content.description}</p><div className="placeholder-card"><div className="placeholder-icon"><CheckCircle2 size={20} /></div><div><h2>Workspace module ready</h2><span>Connect your operational workflow here. The navigation is active and this page is ready to be expanded.</span></div><ArrowUpRight size={18} /></div><Link className="button secondary back-dashboard" href="/"><ArrowLeft size={15} /> Back to approvals</Link></div></main></div>
}
