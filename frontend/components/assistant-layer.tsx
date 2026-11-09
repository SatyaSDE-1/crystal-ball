'use client'

import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AssistantPanel } from '@/components/assistant/assistant-panel'
import { AssistantProvider } from '@/components/assistant/assistant-provider'
import type { Approval } from '@/types/approvals'

/**
 * Client island: the floating "Ask Crystal Ball" button and the assistant it
 * opens. The provider sits outside the open/closed switch, so closing the
 * panel does not lose the conversation.
 */
export function AssistantLayer({ approvals }: { approvals: Approval[] }) {
  const [open, setOpen] = useState(false)

  return <AssistantProvider approvals={approvals}>
    <div className="assistant-layer">
      {open
        ? <AssistantPanel onClose={() => setOpen(false)} />
        : <button type="button" className="cb-launcher" onClick={() => setOpen(true)}>
            <span className="cb-avatar"><Sparkles size={18} aria-hidden="true" /></span>
            <span>Ask Crystal Ball</span>
          </button>}
    </div>
  </AssistantProvider>
}
