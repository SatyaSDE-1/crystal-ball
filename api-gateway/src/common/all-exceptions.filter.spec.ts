import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown, options: { headersSent?: boolean } = {}) {
  const json = jest.fn<void, [Record<string, unknown>]>();
  const status = jest
    .fn<{ json: typeof json }, [number]>()
    .mockReturnValue({ json });
  const end = jest.fn();
  const response = { status, json, end, headersSent: !!options.headersSent };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'GET', url: '/api/x' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return {
    status: status.mock.calls[0]?.[0],
    body: json.mock.calls[0]?.[0],
    end,
    json,
  };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('turns an unknown route into a 404 { error, code }', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /api/nope'));

    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Cannot GET /api/nope', code: 'NOT_FOUND' });
  });

  it('turns a validation failure into a 400 with per-field errors', () => {
    const errors = [{ field: 'mode', message: 'Invalid option' }];

    const { status, body } = run(
      new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        errors,
      }),
    );

    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors,
    });
  });

  it('gives other 400s the BAD_REQUEST code', () => {
    const { status, body } = run(new BadRequestException('Nope'));

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Nope', code: 'BAD_REQUEST' });
  });

  it('turns malformed JSON from the body parser into a clean 400', () => {
    const parseError = Object.assign(
      new SyntaxError('Unexpected token } in JSON at position 12'),
      { status: 400, statusCode: 400, type: 'entity.parse.failed' },
    );

    const { status, body } = run(parseError);

    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'Malformed JSON in the request body',
      code: 'BAD_REQUEST',
    });
  });

  describe('malformed JSON as Nest actually delivers it', () => {
    // Nest wraps the body parser's SyntaxError into a plain
    // BadRequestException(err.message), so only the message is left to go on.
    it.each([
      "Expected ',' or '}' after property value in JSON at position 31 (line 1 column 32)",
      'Unexpected token } in JSON at position 12',
      'Unexpected end of JSON input',
      'Unterminated string in JSON at position 20',
      'Bad control character in string literal in JSON at position 8',
    ])('hides the parser details of: %s', (message) => {
      const { status, body } = run(new BadRequestException(message));

      expect(status).toBe(400);
      expect(body).toEqual({
        error: 'Malformed JSON in the request body',
        code: 'BAD_REQUEST',
      });
    });

    it('does the same for a malformed URL', () => {
      const { status, body } = run(new BadRequestException('URI malformed'));

      expect(status).toBe(400);
      expect(body).toEqual({
        error: 'Malformed request URL',
        code: 'BAD_REQUEST',
      });
    });

    it('leaves other 400 messages alone', () => {
      const { body } = run(new BadRequestException('Question is required'));

      expect(body?.error).toBe('Question is required');
    });
  });

  it('turns an oversized body into a 413', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      type: 'entity.too.large',
    });

    const { status, body } = run(tooLarge);

    expect(status).toBe(413);
    expect(body?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('turns a rate limit hit into a friendly 429', () => {
    const { status, body } = run(new ThrottlerException());

    expect(status).toBe(429);
    expect(body).toEqual({
      error: 'Too many requests. Please wait a minute and try again.',
      code: 'RATE_LIMITED',
    });
  });

  it('turns an unreachable AI service into a 503', () => {
    const refused = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:4001'),
      {
        code: 'ECONNREFUSED',
      },
    );

    const { status, body } = run(refused);

    expect(status).toBe(503);
    expect(body).toEqual({
      error:
        'The AI service is temporarily unavailable. Please try again shortly.',
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('recognises a connection failure by its message too', () => {
    const { status } = run(new Error('connect ECONNREFUSED 127.0.0.1:4001'));

    expect(status).toBe(503);
  });

  it('passes through a client error raised by the AI service', () => {
    const rpcError = {
      statusCode: 400,
      message: 'Invalid help request',
      errors: [{ field: 'question', message: 'Too small' }],
    };

    const { status, body } = run(rpcError);

    expect(status).toBe(400);
    expect(body).toEqual({
      error: 'Invalid help request',
      code: 'VALIDATION_ERROR',
      errors: rpcError.errors,
    });
  });

  it('answers 500 INTERNAL_ERROR for any unexpected error, without its details', () => {
    const { status, body } = run(
      new Error('database password is hunter2 at /srv/app/secret.ts'),
    );

    expect(status).toBe(500);
    expect(body).toEqual({
      error: 'Something went wrong on our side. Please try again.',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('answers 500 for things that are not even errors', () => {
    expect(run('a thrown string').status).toBe(500);
    expect(run(undefined).status).toBe(500);
    expect(run(null).status).toBe(500);
  });

  it('never includes a stack trace', () => {
    for (const exception of [
      new Error('boom'),
      new HttpException('teapot', 418),
      new NotFoundException(),
    ]) {
      const { body } = run(exception);

      expect(JSON.stringify(body)).not.toMatch(
        /stack|node_modules|\bat\s+\S+\s+\(/i,
      );
      expect(Object.keys(body ?? {}).sort()).toEqual(
        expect.arrayContaining(['code', 'error']),
      );
    }
  });

  it('logs unexpected errors with their stack on the server', () => {
    const logError = jest.spyOn(Logger.prototype, 'error');

    run(new Error('boom'));

    expect(logError).toHaveBeenCalled();
  });

  it('does not try to write JSON once a stream has started, it just ends it', () => {
    const { json, end, status } = run(new Error('mid-stream'), {
      headersSent: true,
    });

    expect(status).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
  });
});
