export function AssistantLoading() {
  return <div className="typing" aria-label="Assistant is typing"><span /><span /><span /></div>
}

export function AssistantEmpty({ text = 'Choose an action to start.' }: { text?: string }) {
  return <div className="assistant-empty">{text}</div>
}

export function AssistantError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="assistant-error" role="alert"><span>{message}</span><button onClick={onRetry}>Try again</button></div>
}
