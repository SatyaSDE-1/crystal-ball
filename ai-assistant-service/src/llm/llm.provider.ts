export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {

  system: string;

  messages: LlmMessage[];
 
  temperature?: number;
}


export interface LlmProvider {

  complete(request: LlmRequest): Promise<string>;

  stream(request: LlmRequest): AsyncIterable<string>;
}


export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
