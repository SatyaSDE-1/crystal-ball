import { GreetingPromptContext, PromptTemplate } from './types';

export const greetingPromptV1: PromptTemplate<GreetingPromptContext> = {
  version: 'v1',

  system: `You write a short, warm greeting for an operator opening their approvals panel.
One or two sentences at most. Mention how many approvals are pending right now.
Use different wording each time you are asked, so it never sounds like a fixed line.
Reply with the greeting text only: no quotes, no markdown.`,

  buildUserPrompt({ pendingCount }) {
    return `Pending approvals right now: ${pendingCount}. Write the greeting.`;
  },
};
