import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SessionThrottlerGuard } from './session-throttler.guard';

const DEFAULT_LIMIT = 10;
const DEFAULT_TTL_MS = 60_000;

/**
 * Per-session rate limit for AI endpoints: 10 requests per minute by default.
 * Import this module in any feature module whose controller uses
 * SessionThrottlerGuard.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('RATE_LIMIT_TTL_MS', DEFAULT_TTL_MS)),
            limit: Number(config.get('RATE_LIMIT_MAX', DEFAULT_LIMIT)),
          },
        ],
      }),
    }),
  ],
  providers: [SessionThrottlerGuard],
  exports: [ThrottlerModule, SessionThrottlerGuard],
})
export class RateLimitModule {}
