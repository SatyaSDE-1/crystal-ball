import { SummaryResponse } from '../contracts/schemas';

/** Models often wrap JSON in ```json fences even when told not to. */
function stripCodeFences(raw: string): string {
  const text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return fenced ? fenced[1] : text;
}

/**
 * Turns raw model text into a SummaryResponse, or null if it cannot be
 * trusted. Never throws: the caller decides what to do with null.
 */
export function parseSummary(raw: string): SummaryResponse | null {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFences(raw));
  } catch {
    return null;
  }

  const result = SummaryResponse.safeParse(json);
  return result.success ? result.data : null;
}
