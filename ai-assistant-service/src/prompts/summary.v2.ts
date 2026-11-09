import { languageInstruction } from './language';
import { summaryPromptV1 } from './summary.v1';
import { PromptTemplate, SummaryPromptContext } from './types';

/**
 * v2 = v1 plus the operator's language. v1 is kept untouched, so a prompt
 * change is a new version, never an edit in place.
 */
export const summaryPromptV2: PromptTemplate<SummaryPromptContext> = {
  version: 'v2',

  system: `${summaryPromptV1.system}

Language: if the user message names a language, write "headline" and every "reason" in that language. Everything else stays exactly as specified, in English: the JSON keys, the "urgency" values (high, medium, low), the ids and "source".`,

  buildUserPrompt({ approvals, locale }) {
    const base = summaryPromptV1.buildUserPrompt({ approvals });
    const language = languageInstruction(locale);
    return language ? `${base}\n\n${language}` : base;
  },
};
