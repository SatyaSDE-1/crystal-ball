/** One streamed piece of a chat answer, as sent by ai-assistant-service. */
export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/**
 * Sent when the AI service cannot be reached at all. Generic on purpose:
 * connection details never reach the client.
 */
export const FRIENDLY_ERROR_MESSAGE =
  "Sorry, I couldn't get a response right now. Please try again in a moment.";
