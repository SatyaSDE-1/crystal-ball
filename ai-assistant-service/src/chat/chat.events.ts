/** One streamed piece of a chat answer. */
export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

/**
 * What the operator sees when the stream fails. Deliberately generic: no
 * status codes, keys or stack traces ever reach the client.
 */
export const FRIENDLY_ERROR_MESSAGE =
  "Sorry, I couldn't get a response right now. Please try again in a moment.";
