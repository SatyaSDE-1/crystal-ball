import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

/**
 * TCP transport options, read through ConfigService only.
 * Used by main.ts and by the e2e tests.
 */
export function getMicroserviceOptions(
  config: ConfigService,
): MicroserviceOptions {
  return {
    transport: Transport.TCP,
    options: {
      host: config.get<string>('TCP_HOST', '127.0.0.1'),
      port: Number(config.get('TCP_PORT', 4001)),
    },
  };
}
