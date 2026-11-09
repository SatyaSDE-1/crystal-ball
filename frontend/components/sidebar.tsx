import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Folder,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Sparkles,
} from 'lucide-react'

function LogoMark() {
  return <div className="logo-mark"><span /><span /><span /></div>
}

/** Server component: no state, no handlers, so none of it ships as client JavaScript. */
export function Sidebar({ active, pendingCount }: { active: string; pendingCount?: number }) {
  const items = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Digital Twin', icon: Building2 },
    { label: 'Approvals', icon: CheckCircle2, count: pendingCount },
    { label: 'Sites & Assets', icon: Folder },
    { label: 'Monitoring', icon: Activity },
    { label: 'Reports', icon: FileText },
  ]

  return <aside className="sidebar">
    <div className="brand"><LogoMark /><div><strong>Crystal Ball</strong><span>Command Centre</span></div></div>
    <div className="workspace-switcher"><div className="workspace-icon"><Building2 size={16} /></div><div><small>Workspace</small><b>Northstar Operations</b></div><ChevronDown size={14} /></div>
    <nav className="nav-list" aria-label="Primary navigation">
      <div className="nav-label">OPERATIONS</div>
      {items.map(item => <Link key={item.label} href={item.label === 'Approvals' ? '/' : `/${item.label.toLowerCase().replaceAll(' & ', '-').replaceAll(' ', '-')}`} className={`nav-item ${active === item.label ? 'active' : ''}`}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.count ? <em>{item.count}</em> : null}</Link>)}
      <div className="nav-label settings-label">SYSTEM</div>
      <button className="nav-item"><Settings size={17} strokeWidth={1.8} /><span>Settings</span></button>
    </nav>
    <div className="sidebar-bottom">
      <div className="help-card"><div className="help-icon"><Sparkles size={15} /></div><div><b>Need a hand?</b><span>Ask Crystal Ball AI</span></div><ArrowUpRight size={14} /></div>
      <div className="profile"><div className="avatar avatar-teal">JD</div><div><b>Jordan Davis</b><span>Operations Lead</span></div><MoreHorizontal size={16} /></div>
    </div>
  </aside>
}
