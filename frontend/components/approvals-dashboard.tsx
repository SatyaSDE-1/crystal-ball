'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AssistantPanel } from '@/components/assistant-panel'
import { ApprovalDetailsPanel } from '@/components/approval-details-panel'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileImage,
  FileText,
  Filter,
  Folder,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  XCircle,
  Zap,
} from 'lucide-react'

const approvals = [
  { title: 'Site Patrol Onboarding & Checklists', type: 'Folder', submitter: 'Sam HelpAdmin', initials: 'SH', color: 'bg-violet-100 text-violet-700', date: 'Sep 18', icon: Folder },
  { title: 'Level 2 Drone Patrol Video Demo', type: 'Video', submitter: 'Alex HelpAdmin', initials: 'AH', color: 'bg-blue-100 text-blue-700', date: 'Sep 18', icon: Video },
  { title: 'Safety Equipment & Sensor Specs', type: 'PDF', submitter: 'Sam HelpAdmin', initials: 'SH', color: 'bg-violet-100 text-violet-700', date: 'Sep 18', icon: FileText },
  { title: '360° Spatial Zone Layout & Camera Map', type: 'Image', submitter: 'Elena HelpAdmin', initials: 'EH', color: 'bg-amber-100 text-amber-700', date: 'Sep 18', icon: FileImage },
]

const actions = [
  { label: 'Present me Summary', description: 'Get an intelligent overview of pending approvals.', icon: ClipboardList, response: 'You have 4 approvals waiting for review. All were submitted on September 18, and none have been actioned yet. The oldest item is the Site Patrol Onboarding & Checklists.' },
  { label: 'Talk to me', description: 'Ask questions about your approval queue.', icon: MessageCircle, response: 'I’m ready. Ask me about the approval queue, a specific asset, or what needs your attention next.' },
  { label: 'Help me', description: 'Get answers about approval policies and procedures.', icon: BookOpen, response: 'I can help explain your approval workflow. Review the asset details, confirm the operational context, then choose Approve or Request changes.' },
  { label: 'Teach me', description: 'Learn how to review and manage approvals.', icon: GraduationCap, response: 'Start with the queue. Open an item to inspect its details, check the submitter and asset type, then make a decision with a clear audit trail.' },
  { label: 'Replay Greeting', description: 'Generate a fresh personalized greeting.', icon: RefreshCw, response: 'Welcome back, Operator. Your command centre is ready and 4 approvals are waiting for your review.' },
]

function LogoMark() {
  return <div className="logo-mark"><span /><span /><span /></div>
}

export function Sidebar({ active }: { active: string }) {
  const items = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Digital Twin', icon: Building2 },
    { label: 'Approvals', icon: CheckCircle2, count: 4 },
    { label: 'Sites & Assets', icon: Folder },
    { label: 'Monitoring', icon: Activity },
    { label: 'Reports', icon: FileText },
  ]
  return <aside className="sidebar">
    <div className="brand"><LogoMark /><div><strong>Crystal Ball</strong><span>Command Centre</span></div></div>
    <div className="workspace-switcher"><div className="workspace-icon"><Building2 size={16} /></div><div><small>Workspace</small><b>Northstar Operations</b></div><ChevronDown size={14} /></div>
    <nav className="nav-list" aria-label="Primary navigation">
      <div className="nav-label">OPERATIONS</div>
      {items.map(item => <Link key={item.label} href={item.label === 'Approvals' ? '/' : `/${item.label.toLowerCase().replaceAll(' & ', '-').replaceAll(' ', '-')}`} className={`nav-item ${active === item.label ? 'active' : ''}`}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.count && <em>{item.count}</em>}</Link>)}
      <div className="nav-label settings-label">SYSTEM</div>
      <button className="nav-item"><Settings size={17} strokeWidth={1.8} /><span>Settings</span></button>
    </nav>
    <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Sparkles size={15} /></div><div><b>Need a hand?</b><span>Ask Crystal Ball AI</span></div><ArrowUpRight size={14} /></div><div className="profile"><div className="avatar avatar-teal">JD</div><div><b>Jordan Davis</b><span>Operations Lead</span></div><MoreHorizontal size={16} /></div><Link href="/login" className="logout-button"><LogOut size={16} /><span>Log out</span></Link></div>
  </aside>
}

function StatCard({ label, value, icon: Icon, tone, note }: { label: string; value: string; icon: typeof Clock3; tone: string; note: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={17} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong></div><small>{note}</small></div>
}

function DetailDialog({ approval, onClose }: { approval: typeof approvals[number]; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><div className="detail-modal" role="dialog" aria-modal="true" aria-label={approval.title} onClick={e => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button><div className="detail-preview"><approval.icon size={34} /><span>{approval.type} asset</span></div><div className="detail-content"><div className="eyebrow">PENDING APPROVAL</div><h2>{approval.title}</h2><p>This operational asset is ready for review. Inspect the attached material and confirm that it meets your site and safety requirements.</p><div className="detail-meta"><div><span>Submitted by</span><b><i className={`avatar avatar-small ${approval.color}`}>{approval.initials}</i>{approval.submitter}</b></div><div><span>Submitted</span><b>{approval.date}, 2024</b></div></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Request changes</button><button className="button primary" onClick={onClose}><Check size={16} /> Approve asset</button></div></div></div></div>
}

function Assistant({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'welcome' | 'chat'>('welcome')
  const [selected, setSelected] = useState<typeof actions[number] | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; text: string }[]>([])
  const choose = (action: typeof actions[number]) => { setSelected(action); setMode('chat'); setMessages([{ role: 'assistant', text: action.response }]) }
  const send = () => { if (!input.trim()) return; const text = input.trim(); setMessages(prev => [...prev, { role: 'user', text }, { role: 'assistant', text: 'I’ll look into that for you. Based on the current queue, I recommend starting with the oldest pending item and recording your decision in the review panel.' }]); setInput('') }
  const SelectedIcon = selected?.icon ?? MessageCircle
  if (minimized) return <button className="assistant-pill" onClick={() => setMinimized(false)}><span className="ai-orb small"><Bot size={17} /></span><span>Crystal Ball Assistant</span><span className="online-dot" /></button>
  return <section className="assistant-panel" aria-label="Crystal Ball Assistant"><header className="assistant-header"><div className="ai-orb"><Sparkles size={18} /></div><div><b>Crystal Ball Assistant</b><span><i className="online-dot" /> Your operational intelligence assistant</span></div><button onClick={() => setMinimized(true)} aria-label="Minimize assistant"><PanelRightClose size={17} /></button><button onClick={onClose} aria-label="Close assistant"><X size={17} /></button></header>{mode === 'welcome' ? <div className="assistant-welcome"><div className="greeting"><span className="wave">👋</span><div><b>Hello, Operator!</b><p>Welcome to your command centre. I&apos;m here to help you review approvals, understand operational policies, and guide you through your workflow.</p></div></div><div className="action-grid">{actions.map(action => <button className="action-card" key={action.label} onClick={() => choose(action)}><div className="action-icon"><action.icon size={17} /></div><div><b>{action.label}</b><span>{action.description}</span></div><ArrowUpRight size={14} className="action-arrow" /></button>)}</div></div> : <div className="chat-mode"><button className="back-button" onClick={() => setMode('welcome')}><ArrowLeft size={15} /> Back to actions</button><div className="chat-context"><span className="action-icon"><SelectedIcon size={15} /></span><span>Talking about <b>{selected?.label}</b></span></div><div className="messages">{messages.map((message, i) => <div className={`message ${message.role}`} key={i}>{message.role === 'assistant' && <span className="ai-orb tiny"><Sparkles size={11} /></span>}<div>{message.text}</div></div>)}<div className="typing"><span /><span /><span /></div></div><div className="chat-input"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) send() }} placeholder="Ask anything about approvals..." aria-label="Message assistant" /><button onClick={send} aria-label="Send message"><ArrowUpRight size={17} /></button></div></div>}<footer className="assistant-footer"><span><ShieldCheck size={12} /> Frontend demo · No data leaves your browser</span><button onClick={onClose}>Dismiss</button></footer></section>
}

export default function ApprovalsDashboard() {
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [status, setStatus] = useState('All statuses')
  const [selectedApproval, setSelectedApproval] = useState<typeof approvals[number]>(approvals[0])
  const [assistantOpen, setAssistantOpen] = useState(false)
  const filtered = useMemo(() => approvals.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) && (status === 'All statuses' || status === 'Pending Review')), [search, status])
  return (<div className="app-shell"><Sidebar active="Approvals" /><main className="main-content"><header className="topbar"><button className="mobile-menu" aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Dashboard</span><span>/</span><b>Approvals</b></div><div className="top-actions"><button className="icon-button"><Search size={18} /></button><button className="icon-button notification"><Bell size={18} /><i /></button><div className="top-avatar">JD</div></div></header><div className="page-wrap"><div className="page-heading"><div><div className="eyebrow">OPERATIONS / WORKFLOW</div><h1>Approvals</h1><p>Review and manage pending operational approvals.</p></div><div className="heading-actions"><Link href="/approvals/export" className="button secondary"><Filter size={15} /> Export queue</Link><Link href="/approvals/new" className="button primary"><Plus size={16} /> New approval</Link></div></div><div className="stats-grid"><StatCard label="Total Approvals" value="4" icon={ClipboardList} tone="blue" note="All time" /><StatCard label="Pending Review" value="4" icon={Clock3} tone="amber" note="Needs attention" /><StatCard label="Approved" value="0" icon={CheckCircle2} tone="green" note="This month" /><StatCard label="Rejected" value="0" icon={XCircle} tone="rose" note="This month" /></div><div className="approval-workspace-grid"><section className="queue-section queue-column"><div className="section-heading"><div><h2>Approval queue</h2><p>Items that require your review and decision.</p></div><div className="queue-controls"><div className="search-field"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search approvals..." aria-label="Search approvals" /></div><div className="filter-wrap"><button className="filter-button" onClick={() => setFilterOpen(!filterOpen)}><Filter size={15} /> {status}<ChevronDown size={14} /></button>{filterOpen && <div className="filter-menu">{['All statuses', 'Pending Review'].map(option => <button key={option} onClick={() => { setStatus(option); setFilterOpen(false) }}><span className={status === option ? 'selected-dot' : ''} />{option}</button>)}</div>}</div></div></div><div className="table-card"><div className="table-head"><span>ASSET</span><span>TYPE</span><span>SUBMITTED BY</span><span>STATUS</span><span>DATE</span><span /></div>{filtered.map(approval => <div className="table-row" key={approval.title}><div className="asset-cell"><div className="asset-icon"><approval.icon size={18} /></div><div><b>{approval.title}</b><span>Operational asset</span></div></div><span className="type-cell">{approval.type}</span><span className="submitter"><i className={`avatar avatar-small ${approval.color}`}>{approval.initials}</i>{approval.submitter}</span><span><em className="status-badge"><span /> Pending Review</em></span><span className="date-cell">{approval.date}</span><button className="view-button" onClick={() => setSelectedApproval(approval)}>Review <ArrowUpRight size={14} /></button></div>)}{filtered.length === 0 && <div className="empty-state"><Search size={24} /><b>No approvals found</b><span>Try a different search term.</span></div>}<div className="table-footer"><span>Showing {filtered.length} of 4 approvals</span><div><button disabled>Previous</button><button className="current">1</button><button disabled>Next</button></div></div></div></section>{selectedApproval && <div className="approval-details-wrap"><ApprovalDetailsPanel approval={selectedApproval} /></div>}</div></div></main><div className="assistant-layer">{assistantOpen ? <AssistantPanel onClose={() => setAssistantOpen(false)} /> : <button className="assistant-launcher" onClick={() => setAssistantOpen(true)}><span className="ai-orb"><Sparkles size={19} /></span><span>Ask Crystal Ball</span></button>}</div></div>)
}
