import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

export const GLOBAL_PREFIX = 'api';

/**
 * Shared HTTP wiring, used by main.ts and by the e2e tests so both
 * exercise exactly the same setup.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
  });
  app.useGlobalFilters(new AllExceptionsFilter());
}
