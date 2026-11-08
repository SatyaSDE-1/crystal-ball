import { INestApplication } from '@nestjs/common';
import { configureApp } from './app.setup';

function buildApp(env: Record<string, string> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
  };
  const app = {
    get: jest.fn().mockReturnValue(config),
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
  };
  return app as unknown as INestApplication & typeof app;
}

describe('configureApp', () => {
  it('sets the global prefix to "api"', () => {
    const app = buildApp();

    configureApp(app);

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
  });

  it('enables CORS for the origin from CORS_ORIGIN', () => {
    const app = buildApp({ CORS_ORIGIN: 'http://localhost:3000' });

    configureApp(app);

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:3000',
    });
  });
});
