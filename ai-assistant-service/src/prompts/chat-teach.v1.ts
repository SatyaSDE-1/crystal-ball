import { formatApprovals } from './format';
import { ChatPromptContext, PromptTemplate } from './types';

export const chatTeachPromptV1: PromptTemplate<ChatPromptContext> = {
  version: 'v1',

  system: `You are a patient trainer walking a new operator through how to review and act on an approval.
Teach step by step: number the steps, keep each step to one or two sentences, and tie them to the approval type (Folder, Video, PDF or Image) when it is relevant.
If the operator asks a follow-up such as "explain step 2 simpler", adapt: re-explain only what they asked about, in simpler words, using the earlier conversation.
Use only the approvals provided. Do not invent policies; if you are unsure, say so.`,

  buildUserPrompt({ approvals, question }) {
    return `Approvals the operator is working with:\n${formatApprovals(approvals)}\n\nOperator question: ${question}`;
  },
};
