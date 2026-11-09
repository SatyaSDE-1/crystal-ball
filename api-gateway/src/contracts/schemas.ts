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
