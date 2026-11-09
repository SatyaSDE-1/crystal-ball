import { ChatEvent } from './chat-event';

/**
 * One Server-Sent Events frame:
 *   event: token
 *   data: {"text":"Hi"}
 *   <blank line>
 * The payload is JSON on a single line, so tokens containing line breaks
 * can never break the framing.
 */
export function formatSseEvent(event: ChatEvent): string {
  const { type, ...data } = event;
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}
