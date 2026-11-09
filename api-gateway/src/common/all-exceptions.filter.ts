import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Every error response has this shape. `errors` is added for validation. */
export interface ErrorBody {
  error: string;
  code: string;
  errors?: unknown[];
}

interface Resolved {
  status: number;
  body: ErrorBody;
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
};

// Plain numbers, so they compare cleanly with the numeric statuses below.
const BAD_REQUEST: number = HttpStatus.BAD_REQUEST;
const TOO_MANY_REQUESTS: number = HttpStatus.TOO_MANY_REQUESTS;
const SERVICE_UNAVAILABLE: number = HttpStatus.SERVICE_UNAVAILABLE;

const MESSAGES = {
  rateLimited: 'Too many requests. Please wait a minute and try again.',
  unavailable:
    'The AI service is temporarily unavailable. Please try again shortly.',
  internal: 'Something went wrong on our side. Please try again.',
  badJson: 'Malformed JSON in the request body',
  badUrl: 'Malformed request URL',
  tooLarge: 'Request body is too large',
  validation: 'Validation failed',
};

/**
 * Nest turns the body parser's SyntaxError into a plain
 * BadRequestException(err.message), so the parser's wording (which includes
 * character positions) is all there is to recognise it by.
 */
const JSON_SYNTAX_ERROR_PATTERN =
  /\bin JSON\b|JSON input|Unexpected (token|end|non-whitespace)|Unterminated string|Bad control character|Expected (property name|',')/i;
const URI_ERROR_PATTERN = /^URI malformed$/i;

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
]);
const CONNECTION_ERROR_PATTERN = /ECONNREFUSED|ECONNRESET|EPIPE|ETIMEDOUT/;

function codeFor(status: number): string {
  if (status >= 500) {
    return 'INTERNAL_ERROR';
  }
  return CODE_BY_STATUS[status] ?? `HTTP_${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The AI service is down, refused the connection, or dropped it. */
function isConnectionError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  if (
    typeof error.code === 'string' &&
    CONNECTION_ERROR_CODES.has(error.code)
  ) {
    return true;
  }
  if (
    typeof error.message === 'string' &&
    CONNECTION_ERROR_PATTERN.test(error.message)
  ) {
    return true;
  }
  // Node reports a failed dual-stack connect as an AggregateError.
  return Array.isArray(error.errors) && error.errors.some(isConnectionError);
}

/** A 4xx status carried on an error object (body-parser, or the AI service). */
function clientStatusOf(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const status = error.statusCode ?? error.status;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : undefined;
}

function messageOf(response: string | object): string | undefined {
  if (typeof response === 'string') {
    return response;
  }
  const { message } = response as { message?: unknown };
  if (typeof message === 'string') {
    return message;
  }
  return Array.isArray(message) ? message.join('; ') : undefined;
}

/**
 * The one place errors become responses: always JSON { error, code }, never
 * a stack trace, never internal details. Unexpected errors are logged in
 * full on the server instead.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const { status, body } = this.resolve(exception);
    this.log(exception, status, request);

    // A stream (SSE) is already under way: JSON can no longer be sent.
    if (response.headersSent) {
      response.end();
      return;
    }
    response.status(status).json(body);
  }

  private resolve(exception: unknown): Resolved {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Malformed JSON, oversized body, ...: raised by Express before routing.
    if (exception instanceof Error) {
      const status = clientStatusOf(exception);
      const type = (exception as { type?: unknown }).type;
      if (status !== undefined) {
        if (type === 'entity.parse.failed') {
          return this.of(400, MESSAGES.badJson);
        }
        if (type === 'entity.too.large') {
          return this.of(413, MESSAGES.tooLarge);
        }
        return this.of(status, 'The request could not be processed');
      }
    }

    if (isConnectionError(exception)) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: { error: MESSAGES.unavailable, code: 'SERVICE_UNAVAILABLE' },
      };
    }

    // A client error reported by the AI service (e.g. an invalid payload).
    if (!(exception instanceof Error)) {
      const status = clientStatusOf(exception);
      if (status !== undefined && isRecord(exception)) {
        const message =
          typeof exception.message === 'string'
            ? exception.message
            : MESSAGES.validation;
        const errors = Array.isArray(exception.errors)
          ? exception.errors
          : undefined;
        return errors
          ? {
              status,
              body: { error: message, code: 'VALIDATION_ERROR', errors },
            }
          : this.of(status, message);
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: MESSAGES.internal, code: 'INTERNAL_ERROR' },
    };
  }

  private fromHttpException(exception: HttpException): Resolved {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (status === TOO_MANY_REQUESTS) {
      return this.of(status, MESSAGES.rateLimited);
    }
    if (status >= 500) {
      return this.of(status, MESSAGES.internal);
    }

    // Our validation pipe attaches a per-field list.
    if (isRecord(response) && Array.isArray(response.errors)) {
      return {
        status,
        body: {
          error: messageOf(response) ?? MESSAGES.validation,
          code: 'VALIDATION_ERROR',
          errors: response.errors,
        },
      };
    }

    const message = messageOf(response) ?? exception.message;
    if (status === BAD_REQUEST) {
      if (JSON_SYNTAX_ERROR_PATTERN.test(message)) {
        return this.of(status, MESSAGES.badJson);
      }
      if (URI_ERROR_PATTERN.test(message)) {
        return this.of(status, MESSAGES.badUrl);
      }
    }
    return this.of(status, message);
  }

  private of(status: number, error: string): Resolved {
    return { status, body: { error, code: codeFor(status) } };
  }

  private log(exception: unknown, status: number, request: Request): void {
    const where = `${request.method} ${request.url}`;

    if (status >= 500 && !isConnectionError(exception)) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      const reason =
        exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`${where} -> ${status}: ${reason}`, stack);
    } else if (status === SERVICE_UNAVAILABLE) {
      this.logger.warn(`${where} -> 503: AI service unreachable`);
    }
  }
}
