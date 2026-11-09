/**
 * Where the browser finds the API gateway. NEXT_PUBLIC_ variables are
 * readable by the browser by design, so this holds an address only, never a
 * secret: the LLM key lives in the AI service and is never sent to a client.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
