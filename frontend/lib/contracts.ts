import { z } from 'zod'

/**
 * What the API sends back, checked at the boundary. A response that does not
 * match is rejected before it can reach the UI: the interface never renders
 * raw, unvalidated model output.
 */

export const Source = z.enum(['ai', 'fallback'])
export type Source = z.infer<typeof Source>

export const GreetingResponse = z.object({
  text: z.string().min(1),
  source: Source,
})
export type GreetingResponse = z.infer<typeof GreetingResponse>

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
})
export type SummaryResponse = z.infer<typeof SummaryResponse>

export const HelpResponse = z.object({
  answer: z.string().min(1),
  citations: z.array(z.string()),
  source: Source,
})
export type HelpResponse = z.infer<typeof HelpResponse>

export const ChatEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string().min(1) }),
])
export type ChatEvent = z.infer<typeof ChatEvent>

export type ChatMode = 'talk' | 'teach'
export type ChatTurn = { role: 'user' | 'assistant'; content: string }
