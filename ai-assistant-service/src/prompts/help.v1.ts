import { HelpPromptContext, PromptTemplate } from './types';

export const NOT_COVERED_ANSWER = 'Not covered in the policy note';

export const helpPromptV1: PromptTemplate<HelpPromptContext> = {
  version: 'v1',

  system: `You answer operator questions about the approval policy.
Answer ONLY from the policy excerpts provided in the user message. Do not use general knowledge or outside facts.
If the excerpts do not contain the answer, reply exactly: "${NOT_COVERED_ANSWER}".
Keep the answer short and direct.`,

  buildUserPrompt({ question, chunks }) {
    const context = chunks
      .map((c) => `[${c.id}] ${c.heading}\n${c.text}`)
      .join('\n\n');

    return `Policy excerpts:\n${context}\n\nQuestion: ${question}`;
  },
};
