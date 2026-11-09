export type ApiErrorKind =
  | 'rate_limited'
  | 'unavailable'
  | 'validation'
  | 'network'
  | 'invalid_response'
  | 'unknown'

type ApiErrorOptions = {
  status?: number
  retryAfterSeconds?: number
  fieldErrors?: { field: string; message: string }[]
  /** Technical detail for developers and logs. Never shown to the user. */
  detail?: string
}

/** Every failure talking to the API, sorted into a handful of kinds the UI can explain. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly retryAfterSeconds?: number
  readonly fieldErrors?: { field: string; message: string }[]

  constructor(kind: ApiErrorKind, options: ApiErrorOptions = {}) {
    super(options.detail ?? kind)
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.retryAfterSeconds = options.retryAfterSeconds
    this.fieldErrors = options.fieldErrors
  }
}

/** Builds an ApiError from a non-2xx response ({ error, code } JSON from the gateway). */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  type ErrorBody = { error?: unknown; errors?: unknown }
  const body = (await response.json().catch(() => null)) as ErrorBody | null

  const detail = typeof body?.error === 'string' ? body.error : undefined
  const status = response.status

  if (status === 429) {
    const retry = Number(response.headers.get('Retry-After'))
    return new ApiError('rate_limited', {
      status,
      detail,
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : undefined,
    })
  }
  if (status === 503) return new ApiError('unavailable', { status, detail })
  if (status === 400) {
    const fieldErrors = Array.isArray(body?.errors)
      ? (body.errors as { field: string; message: string }[])
      : undefined
    return new ApiError('validation', { status, detail, fieldErrors })
  }
  return new ApiError('unknown', { status, detail })
}

const MESSAGES: Record<Exclude<ApiErrorKind, 'rate_limited'>, string> = {
  unavailable: 'The assistant is temporarily unavailable. Please try again shortly.',
  validation: "That request wasn't valid. Please check what you typed and try again.",
  network: "Couldn't reach the server. Check your connection and that the API is running, then try again.",
  invalid_response: 'The assistant sent an unexpected response. Please try again.',
  unknown: 'Something went wrong. Please try again.',
}

/** A message safe to show to an operator: no status codes, hosts or stack traces. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'rate_limited') {
      return error.retryAfterSeconds
        ? `You're sending requests too quickly. Please wait ${error.retryAfterSeconds} seconds and try again.`
        : "You're sending requests too quickly. Please wait a moment and try again."
    }
    return MESSAGES[error.kind]
  }
  if (error instanceof TypeError) return MESSAGES.network
  return MESSAGES.unknown
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
