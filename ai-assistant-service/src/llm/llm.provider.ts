export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  /** System prompt (from /prompts). */
  system: string;
  /** Conversation so far; the last item is the current user turn. */
  messages: LlmMessage[];
}

/**
 * What the rest of the app depends on. Swap providers (Cohere, Anthropic,
 * OpenAI...) by providing a different class for LLM_PROVIDER.
 */
export interface LlmProvider {
  /** Full answer as one string. Throws LlmError / LlmTimeoutError. */
  complete(request: LlmRequest): Promise<string>;
  /** Answer as token chunks. Throws LlmError / LlmTimeoutError. */
  stream(request: LlmRequest): AsyncIterable<string>;
}

/** Injection token for the active LlmProvider. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
