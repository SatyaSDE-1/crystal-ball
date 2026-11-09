import { z } from 'zod';

/**
 * Request contracts the gateway validates before anything is forwarded.
 * Kept in sync with ai-assistant-service/src/contracts/schemas.ts, which
 * validates again on its side (defence in depth).
 */

export const ChatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatRequest = z
  .object({
    sessionId: z.string().min(1),
    mode: z.enum(['talk', 'teach']),
    messages: z.array(ChatMessage).min(1),
  })
  .refine(
    // A turn to answer needs the user to have spoken last.
    (request) =>
      request.messages.length === 0 || request.messages.at(-1)?.role === 'user',
    {
      message: 'The last message must be from the user',
      path: ['messages'],
    },
  );
export type ChatRequest = z.infer<typeof ChatRequest>;

export const HelpRequest = z.object({
  question: z.string().min(3),
});
export type HelpRequest = z.infer<typeof HelpRequest>;

/** A language code such as "es", "hi-IN" or "zh-Hant-TW" (what navigator.language returns). */
export const LOCALE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * Summary and greeting take no input except the operator's language, which
 * is optional. The body may be missing or `{}`; anything that is not an
 * object is rejected, and extra fields are dropped.
 */
export const LocaleRequest = z
  .object({ locale: z.string().max(35).regex(LOCALE_PATTERN).optional() })
  .default({});
export type LocaleRequest = z.infer<typeof LocaleRequest>;
