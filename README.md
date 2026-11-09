# Crystal Ball Command Centre

An AI-assisted Approvals panel: summary, talk, help, teach and greeting, each backed by a real LLM call with a tested fallback. Built for the Crystal Ball Command Centre take-home (Sr. Fullstack, MERN + AI, Wave 2).

- `api-gateway/` — NestJS HTTP API (port 4000, prefix `/api`): validation, rate limiting, error handling, SSE.
- `ai-assistant-service/` — NestJS microservice (TCP, port 4001): prompts, Cohere calls, retrieval, fallbacks.
- `docs/postman_collection.json` — the backend checks (success, fallback, rate limit, validation, errors, failure demo) as runnable Postman tests.
- `frontend/` — Next.js UI: the Approvals page and the assistant panel (see [Frontend](#frontend-nextjs-app-router)).
- `docs/WALKTHROUGH.md` — a 5-minute walkthrough script with screenshots, including the failure demo.
- `docs/SYSTEM_DESIGN.md` — the system design: architecture, request flows, AI and fallback design, security, testing, scaling. Its diagrams are in `docs/diagrams/` as Mermaid files.

The gateway talks to the AI service over TCP with `@nestjs/microservices` message patterns (`client.send({ cmd }, payload)`).

```
Browser / Postman
      │  HTTP  /api/*
      ▼
 api-gateway ── Zod validation · rate limit · {error, code} filter · SSE
      │  TCP message pattern
      ▼
 ai-assistant-service ── versioned prompts · LlmProvider (Cohere) · retrieval · fallbacks
```

## Setup

Requires **Node 22** (`nvm use 22`).

```bash
cd ai-assistant-service && npm install && cp .env.example .env   # then set COHERE_API_KEY
cd ../api-gateway && npm install && cp .env.example .env
cd ../frontend && pnpm install
```

Run (three terminals, in this order):

```bash
cd ai-assistant-service && npm run start:dev     # AI service, TCP :4001
cd api-gateway && npm run start:dev              # gateway, http://localhost:4000/api
cd frontend && pnpm dev                          # app, http://localhost:3000
```

Check the backend:  `curl -i http://localhost:4000/api` → **404 JSON** (server is up, prefix works), and `curl http://localhost:4000/api/approvals` → 4 approvals.

### Configuration

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

### Frontend (Next.js App Router)

Pages are rendered on the server wherever possible; only the interactive pieces are client components. Two address settings (see `frontend/.env.example`): `API_URL` (server-only, used while rendering pages) and `NEXT_PUBLIC_API_URL` (used by the browser for the assistant's requests; an address only, never a secret). Both default to `http://localhost:4000/api`, and the gateway's `CORS_ORIGIN` must match the origin the frontend is served from (default `http://localhost:3000`).

| Route | Rendering | Pages Router equivalent |
| --- | --- | --- |
| `/` (Approvals) | server-side rendered on every request; fetches `GET /api/approvals` on the server | `getServerSideProps` |
| `/[section]` (dashboard, reports, ...) | statically generated for the 6 known sections, refreshed every 60 s; other paths 404 | `getStaticPaths` (`fallback: false`) + `getStaticProps` with `revalidate` |
| `/approvals/export` | static, refreshed every 60 s | `getStaticProps` with `revalidate` |
| `/approvals/new` | static; only the form is a client component | `getStaticProps` |

Client islands (need the browser): the approval queue (search, filter, selection), the details panel, the assistant panel, the new-approval form. If the API is down, the Approvals page still renders, with sample data and a visible notice.

#### The assistant panel

Opened with "Ask Crystal Ball", laid out like the reference panel: dark header (avatar, title, info, expand, minimise, close), a "Replay Greeting" link, four action cards, and a footer with the item count. Each action calls the real API:

| Action | API | What the UI shows |
| --- | --- | --- |
| Greeting (on open, and **Replay Greeting**) | `POST /greeting` | a fresh greeting; "Basic greeting" label if the AI was unavailable; a local greeting if the API cannot be reached |
| Present me Summary | `POST /summary` | headline, items ranked by urgency with titles and reasons; "AI summary" badge, or a notice when it is the basic ranking |
| Help me | `POST /help` | answer grounded in the policy note, "Sources" chips; "not covered" shown plainly; example questions |
| Talk to me / Teach me | `POST /chat` (SSE) | multi-turn chat, tokens rendered as they arrive, Stop button, retry, "New conversation"; Talk and Teach keep separate histories |

Loading (skeletons, typing dots), error (friendly alert with **Try again**; rate limits say how long to wait) and "AI unavailable" states are all visible, and the UI never shows status codes, hosts or stack traces. Every response is validated with Zod before it is used, and model text is rendered as plain text (only `**bold**` and lists are interpreted), never as HTML. State lives in one Zustand store (`stores/assistant-store.ts`) created by a provider, so nothing is prop-drilled; the HTTP and SSE code is in `services/`. The browser sends an `x-session-id` (kept in `sessionStorage`) with every request, which the API uses for rate limiting.

Frontend tests (Vitest + Testing Library, needs **Node 22**): `cd frontend && pnpm test`. They cover the SSE parser, the API client, the store, and the panel's loading, streaming and error states.

## Endpoints

AI routes need an `x-session-id` header (used for rate limiting). Every error is JSON `{ "error", "code" }`, never HTML or a stack trace.

| Method | Path | Body | Success response | AI? | Fallback |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/approvals` | — | 4 approvals | no | — |
| POST | `/api/summary` | `{ locale? }` | `{ headline, items[{id, urgency, reason}], source }` | yes | deterministic ranking |
| POST | `/api/greeting` | `{ locale? }` | `{ text, source }` | yes | `You have N approvals pending.` |
| POST | `/api/help` | `{ question }` | `{ answer, citations[], source }` | yes (retrieval + LLM) | top policy chunk verbatim |
| POST | `/api/chat` | `{ sessionId, mode: "talk"\|"teach", messages[] }` | SSE: `token`… then `done` | yes | one `error` event |

`source` is `"ai"` only when the model produced the answer, otherwise `"fallback"`.

Status codes: `400` validation (`VALIDATION_ERROR` with per-field `errors`, or `BAD_REQUEST` for malformed JSON), `404` `NOT_FOUND`, `429` `RATE_LIMITED` (with `Retry-After`), `503` `SERVICE_UNAVAILABLE` when the AI service is down, `500` `INTERNAL_ERROR`.

**The operator's language.** Summary and greeting accept an optional `locale` (a language code such as `es` or `hi-IN`; the browser sends `navigator.language`). For a non-English locale the prompt asks the model to write the headline, reasons and greeting in that language, while the JSON keys, the `urgency` values and the ids stay English so the response is still validated by the same Zod schema. An invalid locale is rejected with `400`. The deterministic fallbacks, and the interface labels, stay English.

Chat is POST + Server-Sent Events (`event: token`, `event: done`, `event: error`). Read it with `fetch` streaming; the browser's `EventSource` is GET-only. Try it: `curl -N -X POST http://localhost:4000/api/chat -H "Content-Type: application/json" -H "x-session-id: t" -d '{"sessionId":"t","mode":"talk","messages":[{"role":"user","content":"Which approval needs my attention first?"}]}'`

### AI usage, fallbacks and trade-offs

**AI-necessary:** the summary (ranking and phrasing items by urgency is judgement), Talk and Teach (free-form, multi-turn, adapting to follow-ups), Help (natural-language questions, answered only from retrieved policy text) and the greeting (fresh wording every time). **AI-unnecessary:** the approvals list (a fixture), the pending count, retrieval over the policy note (keyword scoring), the urgency ranking when the model is down, and every validation. These are deterministic, cheaper and fully testable.

**Fallback design:** every LLM call has an 8 s timeout (`AbortController`). Model output is never trusted: summary JSON is parsed and checked with Zod (each approval exactly once), and a greeting must mention the real count. Any failure, timeout or bad output degrades to a deterministic result marked `source: "fallback"`: a documented ranking rule, `You have N approvals pending.`, the top policy chunk verbatim, or a friendly `error` event on the chat stream. Nothing returns a raw 500, and `FORCE_LLM_FAILURE=true` proves it.

**One thing I'd do differently:** with more time I'd add a small eval set of golden questions for Help and Summary, run against the real model, and swap keyword retrieval for embeddings. Prompt or model changes would then be judged by numbers, not by eye. I'd also warm the model connection at start-up, since the first Cohere call is the slowest.

## Rate limiting

AI routes allow **10 requests per minute per session**, keyed by the `x-session-id` header and falling back to the client IP. It is one budget shared across all AI routes, so switching endpoints does not reset it. The 11th request gets `429` JSON with `Retry-After`. `GET /api/approvals` is never limited. Limits are configurable (`RATE_LIMIT_MAX`, `RATE_LIMIT_TTL_MS`).

Honest limits: the counter is in memory (per gateway instance), and a client can change its own `x-session-id` to get a fresh budget. Fine for a take-home, not for production (use a shared store and authenticated identities).

## Failure demo

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
cd api-gateway && npm test && npm run test:e2e           # validation, rate limit, SSE, error handling, integration
cd frontend && pnpm test                                 # SSE parser, API client, store, chat panel (Vitest + Testing Library)
```

The LLM (`cohere-ai`) is mocked in the tests; everything else is real.

| Kind | Where | What it proves |
| --- | --- | --- |
| Unit (Jest), LLM mocked | `ai-assistant-service/src/**/*.spec.ts` | each prompt, the LLM service (timeout, abort, failure), summary parsing and fallback ranking, greeting checks, retrieval, chat events |
| Integration (Supertest) | `api-gateway/test/ai-integration.e2e-spec.ts` | the **real gateway and the real AI service together** over HTTP and TCP, with only Cohere mocked: success, timeout, failure, bad model output, language, and `FORCE_LLM_FAILURE` for summary, greeting, help and chat (SSE) |
| e2e per endpoint | `api-gateway/test/*.e2e-spec.ts`, `ai-assistant-service/test/*.e2e-spec.ts` | HTTP contracts, validation, rate limiting, error shapes; the AI service's message patterns over TCP |
| Component (Vitest + Testing Library) | `frontend/components/assistant/assistant-panel.test.tsx` | the panel's loading, streaming and error states for all five actions |

Mutation checks were run on the riskiest tests: removing the summary fallback, or breaking the typing indicator or the safe text rendering, makes the matching tests fail.

### Postman

Import `docs/postman_collection.json`. Variables: `baseUrl` (default `http://localhost:4000/api`) and `expectedSource` (empty accepts `ai` or `fallback`; set `ai` for a strict run, or `fallback` while running `demo:fail`). For the rate-limit test (Test 4), run only the **4. Rate limiting** folder with 11 iterations and no delay.

From the terminal with Newman (use `--env-var`; `--global-var` does not override collection variables):

```bash
npx newman run docs/postman_collection.json --env-var "expectedSource=fallback"
```

Note: a Cohere trial key allows only about 20 chat calls per minute. Running the AI collection several times in a row can hit that limit; the app then falls back (as designed), and a strict `expectedSource=ai` run will report failures until the minute passes.

## Notes

- **LLM provider substitution.** The assignment names Claude or GPT-4o; this build uses **Cohere** (`command-a-03-2025`, `CohereClientV2`) as a lightweight substitute. It sits behind an `LlmProvider` interface (`llm.provider.ts`), so changing provider means providing another class in `LlmModule`. The key is used server-side only.
- **Prompts** live in `ai-assistant-service/src/prompts/` as versioned exports (`*.v1.ts`, and `summary.v2.ts` / `greeting.v2.ts`, which add the operator's language). A prompt change is a new version, never an edit in place. There are no inline prompt strings elsewhere.
- **Retrieval** is in-memory keyword scoring (heading-weighted, rarity-weighted) over the 5 sections of `src/data/policy.md`. No vector store.
- **Cold start.** `command-a-03-2025` is slow on its first call after a restart and uneven afterwards; an 8 s timeout can occasionally fall back. A faster model (for example `command-r7b-12-2024`) is a one-line `COHERE_MODEL` change.
- **AI tools used.** The whole app (backend and frontend) was built with **Claude Code** (Anthropic), pair-programming style: scaffolding, writing the failing tests first, implementing, and checking behaviour against the real services, a browser and the Postman collection.

## Assumptions

The assignment says to note an assumption instead of guessing silently. These are mine:

1. **"In the operator's language"** means the browser's language (`navigator.language`), applied to the summary and the greeting. The interface labels and the deterministic fallbacks stay in English; translating those is out of scope.
2. **"Out loud / in text"**: text only. There is no speech output.
3. **LLM provider**: Cohere instead of Claude or GPT-4o (see Notes). It is isolated behind one interface.
4. **Repo layout**: an HTTP gateway plus an AI microservice (the gateway-to-service call is a message pattern) instead of a single `/server` app. Every endpoint, schema and prompt requirement is met by the pair.
5. **"Pending"** means a status that starts with "Pending". The seed data is read-only: "New approval" and "Export queue" are interface prototypes that do not change the queue.
6. **Dates** are shown exactly as the dataset has them ("Sep 18"); no year is invented.
7. **Per-session rate limiting** is keyed by a client-supplied `x-session-id` (the browser generates one per tab and keeps it in `sessionStorage`), which is what the assignment describes. A client can therefore reset its own budget; see the honest limits above.
8. **Reference panel**: the layout, header controls, action cards, Replay Greeting link and footer follow the reference image. The illustrated avatars are replaced by icons, and the dashboard behind the panel is a simplified version of the reference screen.

## Walkthrough and what is not included

- A 5-minute walkthrough script with screenshots (normal mode, the operator's language, and the failure demo) is in [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md). **No video file is included**: it needs a person to record it. The script is written to be read aloud while recording a Loom.
- **No hosted link**: deploying needs hosting accounts and secrets, and the assignment says running locally with clear instructions is fine. The setup steps above are enough to run everything.

