import { greetingPromptV1 } from './greeting.v1';
import { languageInstruction } from './language';
import { GreetingPromptContext, PromptTemplate } from './types';

/**
 * v2 = v1 plus the operator's language. The count must be written as digits
 * so it can be checked whatever language the greeting is in.
 */
export const greetingPromptV2: PromptTemplate<GreetingPromptContext> = {
  version: 'v2',

  system: `${greetingPromptV1.system}
Write the number of pending approvals as digits (for example 4), never as a word.
If the user message names a language, write the greeting in that language.`,

  buildUserPrompt({ pendingCount, locale }) {
    const base = greetingPromptV1.buildUserPrompt({ pendingCount });
    const language = languageInstruction(locale);
    return language ? `${base}\n\n${language}` : base;
  },
};
