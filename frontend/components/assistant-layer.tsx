'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { AssistantPanel } from '@/components/assistant-panel'

/** Client island: the floating "Ask Crystal Ball" button and the assistant it opens. */
export function AssistantLayer() {
  const [open, setOpen] = useState(false)

  return <div className="assistant-layer">
    {open
      ? <AssistantPanel onClose={() => setOpen(false)} />
      : <button className="assistant-launcher" onClick={() => setOpen(true)}><span className="ai-orb"><Sparkles size={19} /></span><span>Ask Crystal Ball</span></button>}
  </div>
}
