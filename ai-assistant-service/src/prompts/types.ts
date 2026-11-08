import { Approval } from '../contracts/schemas';

/** A versioned prompt. Bump the version (new file) instead of editing in place. */
export interface PromptTemplate<Ctx> {
  version: string;
  system: string;
  buildUserPrompt(ctx: Ctx): string;
}

/** Context for prompts that reason over the approvals queue. */
export interface ApprovalsContext {
  approvals: Approval[];
}

/** Context for the conversational prompts (talk / teach). */
export interface ChatPromptContext extends ApprovalsContext {
  question: string;
}

/** One retrieved policy chunk, as passed to the help prompt. */
export interface PolicyChunk {
  id: string;
  heading: string;
  text: string;
}

export interface HelpPromptContext {
  question: string;
  chunks: PolicyChunk[];
}

export interface GreetingPromptContext {
  pendingCount: number;
}
