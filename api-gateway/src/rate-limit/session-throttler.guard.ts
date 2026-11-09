import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveTracker } from './tracker';

/**
 * Throttles per session (x-session-id, else IP).
 *
 * Apply with @UseGuards(SessionThrottlerGuard) on AI controllers only.
 * It is deliberately not a global guard, so /approvals is never limited.
 */
@Injectable()
export class SessionThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(
      resolveTracker(req as Parameters<typeof resolveTracker>[0]),
    );
  }

  /**
   * The default key includes the controller and handler, which would give
   * every AI route its own 10/min. Key on the tracker only, so one session
   * has a single budget across all AI routes.
   */
  protected generateKey(
    _context: ExecutionContext,
    tracker: string,
    throttlerName: string,
  ): string {
    return `${throttlerName}:${tracker}`;
  }
}
