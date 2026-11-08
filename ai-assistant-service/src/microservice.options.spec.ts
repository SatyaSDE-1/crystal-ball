import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { getMicroserviceOptions } from './microservice.options';

function buildConfig(env: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('getMicroserviceOptions', () => {
  it('uses the TCP transport with host and port from config', () => {
    const options = getMicroserviceOptions(
      buildConfig({ TCP_HOST: '0.0.0.0', TCP_PORT: '4500' }),
    );

    expect(options).toEqual({
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port: 4500 },
    });
  });

  it('falls back to 127.0.0.1:4001 when nothing is configured', () => {
    const options = getMicroserviceOptions(buildConfig());

    expect(options).toEqual({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 4001 },
    });
  });
});
