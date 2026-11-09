# Crystal Ball Command Centre

An AI-assisted Approvals panel: summary, talk, help, teach and greeting, each backed by a real LLM call with a tested fallback. This README covers the **backend**.

- `api-gateway/` — NestJS HTTP API (port 4000, prefix `/api`): validation, rate limiting, error handling, SSE.
- `ai-assistant-service/` — NestJS microservice (TCP, port 4001): prompts, Cohere calls, retrieval, fallbacks.
- `docs/postman_collection.json` — every backend check from the assignment, as runnable Postman tests.
- `frontend/` — Next.js UI (not covered here).

The gateway talks to the AI service over TCP with `@nestjs/microservices` message patterns (`client.send({ cmd }, payload)`).

```
Browser / Postman
      │  HTTP  /api/*
      ▼
 api-gateway ── Zod validation · rate limit · {error, code} filter · SSE
      │  TCP message pattern
      ▼
 ai-assistant-service ── prompts/*.v1.ts · LlmProvider (Cohere) · retrieval · fallbacks
```

## Setup

Requires **Node 22** (`nvm use 22`).

```bash
cd ai-assistant-service && npm install && cp .env.example .env   # then set COHERE_API_KEY
cd ../api-gateway && npm install && cp .env.example .env
```

Run (AI service first, two terminals):

```bash
cd ai-assistant-service && npm run start:dev
cd api-gateway && npm run start:dev
```

Check it works: `curl -i http://localhost:4000/api` → **404 JSON** (server is up, prefix works), and `curl http://localhost:4000/api/approvals` → 4 approvals.

| Service | Variable | Default | Purpose |
| --- | --- | --- | --- |
| gateway | `PORT` | 4000 | HTTP port |
| gateway | `CORS_ORIGIN` | `http://localhost:3000` | allowed browser origin |
| gateway | `AI_ASSISTANT_HOST` / `AI_ASSISTANT_PORT` | `127.0.0.1` / `4001` | where the AI service listens |
| gateway | `RATE_LIMIT_MAX` / `RATE_LIMIT_TTL_MS` | `10` / `60000` | per-session limit |
| AI service | `COHERE_API_KEY` | — | server-side only, never sent to a client |
| AI service | `COHERE_MODEL` | `command-a-03-2025` | model |
| AI service | `LLM_TIMEOUT_MS` | `8000` | per-call timeout |
| AI service | `TCP_HOST` / `TCP_PORT` | `127.0.0.1` / `4001` | TCP transport |
| AI service | `FORCE_LLM_FAILURE` | unset | `true` makes every LLM call fail (demo) |

All configuration is read through `ConfigService`. `.env` is git-ignored.

## Endpoints

AI routes need an `x-session-id` header (used for rate limiting). Every error is JSON `{ "error", "code" }`, never HTML or a stack trace.

| Method | Path | Body | Success response | AI? | Fallback |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/approvals` | — | 4 approvals | no | — |
| POST | `/api/summary` | `{}` | `{ headline, items[{id, urgency, reason}], source }` | yes | deterministic ranking |
| POST | `/api/greeting` | `{}` | `{ text, source }` | yes | `You have N approvals pending.` |
| POST | `/api/help` | `{ question }` | `{ answer, citations[], source }` | yes (retrieval + LLM) | top policy chunk verbatim |
| POST | `/api/chat` | `{ sessionId, mode: "talk"\|"teach", messages[] }` | SSE: `token`… then `done` | yes | one `error` event |

`source` is `"ai"` only when the model produced the answer, otherwise `"fallback"`.

Status codes: `400` validation (`VALIDATION_ERROR` with per-field `errors`, or `BAD_REQUEST` for malformed JSON), `404` `NOT_FOUND`, `429` `RATE_LIMITED` (with `Retry-After`), `503` `SERVICE_UNAVAILABLE` when the AI service is down, `500` `INTERNAL_ERROR`.

Chat is POST + Server-Sent Events (`event: token`, `event: done`, `event: error`). Read it with `fetch` streaming; the browser's `EventSource` is GET-only. Try it: `curl -N -X POST http://localhost:4000/api/chat -H "Content-Type: application/json" -H "x-session-id: t" -d '{"sessionId":"t","mode":"talk","messages":[{"role":"user","content":"Which approval needs my attention first?"}]}'`

### AI usage, fallbacks and trade-offs

**AI-necessary:** the summary (ranking and phrasing items by urgency is judgement), Talk and Teach (free-form, multi-turn, adapting to follow-ups), Help (natural-language questions, answered only from retrieved policy text) and the greeting (fresh wording every time). **AI-unnecessary:** the approvals list (a fixture), the pending count, retrieval over the policy note (keyword scoring), the urgency ranking when the model is down, and every validation. These are deterministic, cheaper and fully testable.

**Fallback design:** every LLM call has an 8 s timeout (`AbortController`). Model output is never trusted: summary JSON is parsed and checked with Zod (each approval exactly once), and a greeting must mention the real count. Any failure, timeout or bad output degrades to a deterministic result marked `source: "fallback"`: a documented ranking rule, `You have N approvals pending.`, the top policy chunk verbatim, or a friendly `error` event on the chat stream. Nothing returns a raw 500, and `FORCE_LLM_FAILURE=true` proves it.

**One thing I'd do differently:** with more time I'd add a small eval set of golden questions for Help and Summary, run against the real model, and swap keyword retrieval for embeddings. Prompt or model changes would then be judged by numbers, not by eye. I'd also warm the model connection at start-up, since the first Cohere call is the slowest.

## Rate limiting

AI routes allow **10 requests per minute per session**, keyed by the `x-session-id` header and falling back to the client IP. It is one budget shared across all AI routes, so switching endpoints does not reset it. The 11th request gets `429` JSON with `Retry-After`. `GET /api/approvals` is never limited. Limits are configurable (`RATE_LIMIT_MAX`, `RATE_LIMIT_TTL_MS`).

Honest limits: the counter is in memory (per gateway instance), and a client can change its own `x-session-id` to get a fresh budget. Fine for a take-home, not for production (use a shared store and authenticated identities).

## Failure demo (Test 11)

Force every LLM call to fail and watch the app degrade gracefully:

```bash
cd ai-assistant-service && npm run demo:fail     # starts the AI service with FORCE_LLM_FAILURE=true
cd api-gateway && npm run start:dev
```

Summary, greeting and help return `200` with `source: "fallback"`, chat sends an `error` event, and nothing returns `500`. Restart normally and everything shows `source: "ai"` again.

## Tests

Tests were written first (failing), then the minimum code to pass; see the commit history.

```bash
cd ai-assistant-service && npm test && npm run test:e2e   # prompts, LLM service, summary, greeting, help, chat, fallbacks
cd api-gateway && npm test && npm run test:e2e           # validation, rate limit, SSE, error handling
```

The LLM (`cohere-ai`) is mocked in unit and e2e tests; e2e tests drive the real TCP transport and real HTTP (Supertest).

### Postman

Import `docs/postman_collection.json`. Variables: `baseUrl` (default `http://localhost:4000/api`) and `expectedSource` (empty accepts `ai` or `fallback`; set `ai` for a strict run, or `fallback` while running `demo:fail`). For the rate-limit test (Test 4), run only the **4. Rate limiting** folder with 11 iterations and no delay.

From the terminal with Newman (use `--env-var`; `--global-var` does not override collection variables):

```bash
npx newman run docs/postman_collection.json --env-var "expectedSource=fallback"
```

Note: a Cohere trial key allows only about 20 chat calls per minute. Running the AI collection several times in a row can hit that limit; the app then falls back (as designed), and a strict `expectedSource=ai` run will report failures until the minute passes.

## Notes

- **LLM provider substitution.** The assignment names Claude or GPT-4o; this build uses **Cohere** (`command-a-03-2025`, `CohereClientV2`) as a lightweight substitute. It sits behind an `LlmProvider` interface (`llm.provider.ts`), so changing provider means providing another class in `LlmModule`. The key is used server-side only.
- **Prompts** live in `ai-assistant-service/src/prompts/*.v1.ts` as versioned exports; there are no inline prompt strings elsewhere.
- **Retrieval** is in-memory keyword scoring (heading-weighted, rarity-weighted) over the 5 sections of `src/data/policy.md`. No vector store.
- **Cold start.** `command-a-03-2025` is slow on its first call after a restart and uneven afterwards; an 8 s timeout can occasionally fall back. A faster model (for example `command-r7b-12-2024`) is a one-line `COHERE_MODEL` change.
- **AI tools used.** This backend was built with **Claude Code** (Anthropic), pair-programming style: scaffolding, writing the failing tests first, implementing, and checking behaviour against the real services and the Postman collection.