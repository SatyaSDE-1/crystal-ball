/**
 * Integration test: the REAL gateway and the REAL AI service, talking over
 * real TCP, driven through HTTP with Supertest. Only the Cohere SDK is mocked,
 * so every success, timeout and failure below goes through the actual
 * prompts, parsing, validation and fallback code of both services.
 *
 * The AI service is loaded from its own source and its own node_modules (it
 * has its own copy of Nest), exactly as it runs in production.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
// the AI service, with its own Nest
import { ConfigService as AiConfigService } from '../../ai-assistant-service/node_modules/@nestjs/config';
import { NestFactory as AiNestFactory } from '../../ai-assistant-service/node_modules/@nestjs/core';
import { AppModule as AiAppModule } from '../../ai-assistant-service/src/app.module';
import { getMicroserviceOptions } from '../../ai-assistant-service/src/microservice.options';

const mockChat = jest.fn();
const mockChatStream = jest.fn();

jest.mock('../../ai-assistant-service/node_modules/cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: mockChatStream,
  })),
}));

const AI_PORT = 4120;

const aiSummary = {
  headline: 'Four approvals await review; safety specs come first.',
  items: [
    { id: 'apr-3', urgency: 'high', reason: 'Safety specs block the demo.' },
    { id: 'apr-1', urgency: 'medium', reason: 'Onboarding needed soon.' },
    { id: 'apr-4', urgency: 'medium', reason: 'Layout affects patrols.' },
    { id: 'apr-2', urgency: 'low', reason: 'Demo video, not blocking.' },
  ],
  source: 'ai',
};

const cohereReply = (text: string) => ({
  message: { content: [{ type: 'text', text }] },
});

async function* cohereStream(...texts: string[]) {
  yield { type: 'message-start' };
  for (const text of texts) {
    await Promise.resolve();
    yield { type: 'content-delta', delta: { message: { content: { text } } } };
  }
  yield { type: 'message-end' };
}

const textParser = (
  res: request.Response,
  callback: (error: Error | null, body: string) => void,
) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => (data += chunk));
  res.on('end', () => callback(null, data));
};

const eventNames = (raw: string) =>
  [...raw.matchAll(/^event: (.+)$/gm)].map((match) => match[1]);

describe('AI endpoints, gateway + AI service together (integration)', () => {
  let aiApp: INestApplication;
  let gateway: INestApplication<App>;
  let session = 0;

  /** a fresh session id per request, so rate limiting never gets in the way */
  const post = (path: string, body: unknown = {}) =>
    request(gateway.getHttpServer())
      .post(`/api${path}`)
      .set('x-session-id', `integration-${++session}`)
      .send(body as object);

  beforeAll(async () => {
    process.env.TCP_HOST = '127.0.0.1';
    process.env.TCP_PORT = String(AI_PORT);
    process.env.AI_ASSISTANT_HOST = '127.0.0.1';
    process.env.AI_ASSISTANT_PORT = String(AI_PORT);
    process.env.COHERE_API_KEY = 'test-key';
    process.env.LLM_TIMEOUT_MS = '200';

    aiApp = await AiNestFactory.create(AiAppModule, { logger: false });
    aiApp.connectMicroservice(
      getMicroserviceOptions(aiApp.get(AiConfigService)),
    );
    await aiApp.startAllMicroservices();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    gateway = moduleRef.createNestApplication();
    configureApp(gateway);
    await gateway.init();
  });

  afterAll(async () => {
    await gateway.close();
    await aiApp.close();
  });

  beforeEach(() => {
    mockChat.mockReset();
    mockChatStream.mockReset();
    delete process.env.FORCE_LLM_FAILURE;
  });

  it('GET /api/approvals returns the 4 real fixtures from the AI service', async () => {
    const res = await request(gateway.getHttpServer())
      .get('/api/approvals')
      .expect(200);

    expect(res.body as unknown[]).toHaveLength(4);
  });

  describe('POST /api/summary', () => {
    it('SUCCESS: returns the AI summary, validated, with source "ai"', async () => {
      mockChat.mockResolvedValue(cohereReply(JSON.stringify(aiSummary)));

      const res = await post('/summary').expect(200);

      const body = res.body as typeof aiSummary;
      expect(body.source).toBe('ai');
      expect(body.items).toHaveLength(4);
      expect(['high', 'medium', 'low']).toEqual(
        expect.arrayContaining(body.items.map((item) => item.urgency)),
      );
    });

    it('TIMEOUT: a stalled LLM gives 200 with the ranked fallback, not a 500', async () => {
      mockChat.mockReturnValue(new Promise(() => {})); // never answers

      const res = await post('/summary').expect(200);

      const body = res.body as typeof aiSummary;
      expect(body.source).toBe('fallback');
      expect(body.items).toHaveLength(4);
      expect(body.items[0]).toMatchObject({ id: 'apr-3', urgency: 'high' });
    });

    it('FAILURE: a rejected key gives 200 with the fallback', async () => {
      mockChat.mockRejectedValue(new Error('401 invalid api token'));

      const res = await post('/summary').expect(200);

      expect((res.body as { source: string }).source).toBe('fallback');
    });

    it('BAD OUTPUT: malformed JSON or an invalid urgency gives the fallback', async () => {
      mockChat.mockResolvedValueOnce(cohereReply('{"headline": "cut off'));
      const malformed = await post('/summary').expect(200);

      const invalid = {
        ...aiSummary,
        items: aiSummary.items.map((item) => ({
          ...item,
          urgency: 'critical',
        })),
      };
      mockChat.mockResolvedValueOnce(cohereReply(JSON.stringify(invalid)));
      const badUrgency = await post('/summary').expect(200);

      expect((malformed.body as { source: string }).source).toBe('fallback');
      expect((badUrgency.body as { source: string }).source).toBe('fallback');
    });

    it("LANGUAGE: the operator's locale reaches the model's prompt", async () => {
      mockChat.mockResolvedValue(cohereReply(JSON.stringify(aiSummary)));

      await post('/summary', { locale: 'es' }).expect(200);

      const [body] = mockChat.mock.calls[0] as [{ messages: unknown[] }];
      expect(JSON.stringify(body.messages)).toContain('Spanish');
    });
  });

  describe('POST /api/greeting', () => {
    it('SUCCESS: returns a fresh AI greeting that mentions the count', async () => {
      mockChat.mockResolvedValue(
        cohereReply('Welcome back! 4 approvals await.'),
      );

      const res = await post('/greeting').expect(200);

      expect(res.body).toEqual({
        text: 'Welcome back! 4 approvals await.',
        source: 'ai',
      });
    });

    it('TIMEOUT: falls back to "You have 4 approvals pending."', async () => {
      mockChat.mockReturnValue(new Promise(() => {}));

      const res = await post('/greeting').expect(200);

      expect(res.body).toEqual({
        text: 'You have 4 approvals pending.',
        source: 'fallback',
      });
    });
  });

  describe('POST /api/help', () => {
    it('SUCCESS: answers from the retrieved policy, with citations', async () => {
      mockChat.mockResolvedValue(
        cohereReply('Reject items that are corrupt or outdated.'),
      );

      const res = await post('/help', {
        question: 'What are the rejection criteria?',
      }).expect(200);

      const body = res.body as { source: string; citations: string[] };
      expect(body.source).toBe('ai');
      expect(body.citations).toContain('rejection-criteria');
    });

    it('NOT COVERED: an unrelated question never reaches the model', async () => {
      const res = await post('/help', {
        question: 'What is the capital of France?',
      }).expect(200);

      expect(res.body).toMatchObject({
        answer: 'Not covered in the policy note',
        citations: [],
      });
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('TIMEOUT: falls back to the top policy chunk, verbatim', async () => {
      mockChat.mockReturnValue(new Promise(() => {}));

      const res = await post('/help', {
        question: 'What are the rejection criteria?',
      }).expect(200);

      const body = res.body as {
        source: string;
        answer: string;
        citations: string[];
      };
      expect(body.source).toBe('fallback');
      expect(body.answer).toContain('Reject an item when the file is corrupt');
      expect(body.citations).toEqual(['rejection-criteria']);
    });
  });

  describe('POST /api/chat (SSE)', () => {
    const chatBody = {
      sessionId: 'integration',
      mode: 'talk',
      messages: [{ role: 'user', content: 'Which approval is first?' }],
    };

    it('SUCCESS: streams token events, then done', async () => {
      mockChatStream.mockResolvedValue(
        cohereStream('Safety', ' specs', ' first'),
      );

      const res = await post('/chat', chatBody)
        .buffer(true)
        .parse(textParser)
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/event-stream/);
      expect(eventNames(res.body as string)).toEqual([
        'token',
        'token',
        'token',
        'done',
      ]);
    });

    it('FAILURE: sends one friendly error event and closes, instead of a 500', async () => {
      mockChatStream.mockRejectedValue(new Error('401 invalid api token'));

      const res = await post('/chat', chatBody)
        .buffer(true)
        .parse(textParser)
        .expect(200);

      const raw = res.body as string;
      expect(eventNames(raw)).toEqual(['error']);
      expect(raw).not.toMatch(/401|api token/i);
    });

    it('TIMEOUT: a stalled stream ends with an error event, not a hang', async () => {
      mockChatStream.mockReturnValue(new Promise(() => {}));

      const res = await post('/chat', chatBody)
        .buffer(true)
        .parse(textParser)
        .expect(200);

      expect(eventNames(res.body as string)).toEqual(['error']);
    });
  });

  describe('FORCE_LLM_FAILURE=true (the failure demo)', () => {
    it('degrades every AI endpoint to its fallback, and never calls the model', async () => {
      process.env.FORCE_LLM_FAILURE = 'true';

      const summary = await post('/summary').expect(200);
      const greeting = await post('/greeting').expect(200);
      const help = await post('/help', {
        question: 'What are the rejection criteria?',
      }).expect(200);
      const chat = await post('/chat', {
        sessionId: 'i',
        mode: 'talk',
        messages: [{ role: 'user', content: 'Hi' }],
      })
        .buffer(true)
        .parse(textParser)
        .expect(200);

      expect((summary.body as { source: string }).source).toBe('fallback');
      expect((greeting.body as { source: string }).source).toBe('fallback');
      expect((help.body as { source: string }).source).toBe('fallback');
      expect(eventNames(chat.body as string)).toEqual(['error']);
      expect(mockChat).not.toHaveBeenCalled();
      expect(mockChatStream).not.toHaveBeenCalled();
    });
  });
});
