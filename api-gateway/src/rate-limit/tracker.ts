interface TrackableRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

export const SESSION_HEADER = 'x-session-id';

/**
 * Who a request counts against: the x-session-id header when present,
 * otherwise the client IP. Prefixed so a session id can never collide with
 * an IP address that looks the same.
 */
export function resolveTracker(req: TrackableRequest): string {
  const header = req.headers[SESSION_HEADER];
  const sessionId = (Array.isArray(header) ? header[0] : header)?.trim();

  if (sessionId) {
    return `session:${sessionId}`;
  }
  return `ip:${req.ip ?? 'unknown'}`;
}
