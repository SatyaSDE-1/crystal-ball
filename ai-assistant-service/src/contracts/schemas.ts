import { z } from 'zod';

/**
 * Request/response contracts for the AI assistant.
 *
 * Each schema shares its name with its inferred type, so callers can write
 * `SummaryResponse.safeParse(x)` and annotate with `SummaryResponse`.
 */

/** Where a response came from: the LLM, or the deterministic fallback. */
export const Source = z.enum(['ai', 'fallback']);
export type Source = z.infer<typeof Source>;

export const Approval = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['Folder', 'Video', 'PDF', 'Image']),
  submittedBy: z.string().min(1),
  status: z.string().min(1),
  submittedDate: z.string().min(1),
});
export type Approval = z.infer<typeof Approval>;

export const SummaryResponse = z.object({
  headline: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string().min(1),
      urgency: z.enum(['high', 'medium', 'low']),
      reason: z.string().min(1),
    }),
  ),
  source: Source,
});
export type SummaryResponse = z.infer<typeof SummaryResponse>;

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

export const HelpResponse = z.object({
  answer: z.string().min(1),
  citations: z.array(z.string()),
  source: Source,
});
export type HelpResponse = z.infer<typeof HelpResponse>;

export const GreetingResponse = z.object({
  text: z.string().min(1),
  source: Source,
});
export type GreetingResponse = z.infer<typeof GreetingResponse>;
