import { INestApplication } from '@nestjs/common';
import { configureApp } from './app.setup';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

function buildApp(env: Record<string, string> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: string) => env[key] ?? fallback),
  };
  const setGlobalPrefix = jest.fn();
  const enableCors = jest.fn();
  const useGlobalFilters = jest.fn();
  const app = {
    get: jest.fn().mockReturnValue(config),
    setGlobalPrefix,
    enableCors,
    useGlobalFilters,
  } as unknown as INestApplication;

  return { app, setGlobalPrefix, enableCors, useGlobalFilters };
}

describe('configureApp', () => {
  it('sets the global prefix to "api"', () => {
    const { app, setGlobalPrefix } = buildApp();

    configureApp(app);

    expect(setGlobalPrefix).toHaveBeenCalledWith('api');
  });

  it('enables CORS for the origin from CORS_ORIGIN', () => {
    const { app, enableCors } = buildApp({
      CORS_ORIGIN: 'http://localhost:3000',
    });

    configureApp(app);

    expect(enableCors).toHaveBeenCalledWith({
      origin: 'http://localhost:3000',
    });
  });

  it('registers the global exception filter', () => {
    const { app, useGlobalFilters } = buildApp();

    configureApp(app);

    expect(useGlobalFilters).toHaveBeenCalledWith(
      expect.any(AllExceptionsFilter),
    );
  });
});
