/** Any failure talking to the LLM provider. Callers fall back on this. */
export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmError';
  }
}

/** The provider did not answer within LLM_TIMEOUT_MS. */
export class LlmTimeoutError extends LlmError {
  constructor(timeoutMs: number) {
    super(`LLM did not respond within ${timeoutMs}ms`);
    this.name = 'LlmTimeoutError';
  }
}
