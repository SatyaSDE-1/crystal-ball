/** One streamed piece of a chat answer. */
export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };


export const FRIENDLY_ERROR_MESSAGE =
  "Sorry, I couldn't get a response right now. Please try again in a moment.";
