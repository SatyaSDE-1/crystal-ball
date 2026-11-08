import { formatApprovals } from './format';
import { ChatPromptContext, PromptTemplate } from './types';

export const chatTalkPromptV1: PromptTemplate<ChatPromptContext> = {
  version: 'v1',

  system: `You are a friendly assistant helping an operator talk through their approvals queue.
Answer questions about the approvals you are given: what needs attention first, who submitted what, and why.
Use only the approvals provided in the conversation. If the operator asks about something outside the approvals queue, say so briefly and steer back to it.
Keep answers short, plain and practical. Refer to items by title.`,

  buildUserPrompt({ approvals, question }) {
    return `Current approvals queue:\n${formatApprovals(approvals)}\n\nOperator question: ${question}`;
  },
};
