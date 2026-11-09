import { CircleAlert, RotateCcw } from 'lucide-react'

/** Three bouncing dots: the assistant is working on an answer. */
export function TypingIndicator() {
  return <div className="cb-typing" role="status" aria-label="Assistant is typing"><span /><span /><span /></div>
}

/** Placeholder bars shown while something loads. `label` is what a screen reader hears. */
export function Skeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return <div className="cb-skeleton" role="status" aria-label={label}>
    {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${100 - i * 18}%` }} />)}
  </div>
}

/** A visible, friendly error with a way to recover. Never shows technical detail. */
export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="cb-error" role="alert">
    <CircleAlert size={16} aria-hidden="true" />
    <span>{message}</span>
    {onRetry && <button type="button" onClick={onRetry}><RotateCcw size={13} aria-hidden="true" /> Try again</button>}
  </div>
}

/** Explains why a plain answer is shown instead of an AI one. */
export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="cb-notice">{children}</p>
}
