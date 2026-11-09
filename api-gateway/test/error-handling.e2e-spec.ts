import {
  Controller,
  Get,
  INestApplication,
  INestMicroservice,
} from '@nestjs/common';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import {
  ApprovalsPtrn,
  GreetingPtrn,
  HelpPtrn,
  SummaryPtrn,
} from './../src/messagepattern';

const STUB_PORT = 4113;
const DEAD_PORT = 4198; // nothing listens here

/** Stands in for ai-assistant-service, over a real TCP socket. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: ApprovalsPtrn })
  getApprovals() {
    return [];
  }

  @MessagePattern({ cmd: SummaryPtrn })
  getSummary() {
    return { headline: 'ok', items: [], source: 'fallback' };
  }

  @MessagePattern({ cmd: GreetingPtrn })
  getGreeting() {
    return { text: 'You have 4 approvals pending.', source: 'fallback' };
  }

  @MessagePattern({ cmd: HelpPtrn })
  getHelp() {
    return { answer: 'ok', citations: [], source: 'fallback' };
  }
}

/** A route that blows up in an unexpected way. */
@Controller('boom')
class ExplodingController {
  @Get()
  explode() {
    throw new Error('database password is hunter2 at /srv/app/secret.ts');
  }
}

interface ErrorBody {
  error: string;
  code: string;
  errors?: { field: string; message: string }[];
}

async function createApp(aiPort: number): Promise<INestApplication<App>> {
  process.env.AI_ASSISTANT_HOST = '127.0.0.1';
  process.env.AI_ASSISTANT_PORT = String(aiPort);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ExplodingController],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Global error handling (e2e)', () => {
  let app: INestApplication<App>;
  let stub: INestMicroservice;

  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    const stubModule = await Test.createTestingModule({
      controllers: [StubAiAssistantController],
    }).compile();
    stub = stubModule.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: STUB_PORT },
    });
    await stub.listen();

    app = await createApp(STUB_PORT);
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
  });

  describe('unknown routes (Test 10)', () => {
    it('GET /api/nope answers 404 { error, code } JSON, not HTML', async () => {
      const res = await server().get('/api/nope').expect(404);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = res.body as ErrorBody;
      expect(body.code).toBe('NOT_FOUND');
      expect(typeof body.error).toBe('string');
      expect(res.text).not.toContain('<html');
    });

    it('answers an unsupported method with JSON too', async () => {
      const res = await server().delete('/api/approvals').expect(404);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect((res.body as ErrorBody).code).toBe('NOT_FOUND');
    });
  });

  describe('validation (Test 9)', () => {
    it('POST /api/help with {} answers 400 with a field error', async () => {
      const res = await server()
        .post('/api/help')
        .set('x-session-id', 'e1')
        .send({})
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors?.map((e) => e.field)).toEqual(['question']);
    });

    it('POST /api/help with a too-short question answers 400', async () => {
      const res = await server()
        .post('/api/help')
        .set('x-session-id', 'e2')
        .send({ question: 'hi' })
        .expect(400);

      expect((res.body as ErrorBody).errors?.[0].field).toBe('question');
    });

    it('POST /api/chat with mode "banana" answers 400 naming the field', async () => {
      const res = await server()
        .post('/api/chat')
        .set('x-session-id', 'e3')
        .send({
          sessionId: 's',
          mode: 'banana',
          messages: [{ role: 'user', content: 'hi' }],
        })
        .expect(400);

      const body = res.body as ErrorBody;
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors?.map((e) => e.field)).toContain('mode');
    });

    it('POST /api/help with malformed JSON answers 400 JSON', async () => {
      const res = await server()
        .post('/api/help')
        .set('x-session-id', 'e4')
        .set('Content-Type', 'application/json')
        .send('{"question": "What is the SLA?"') // truncated
        .expect(400);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = res.body as ErrorBody;
      expect(body.code).toBe('BAD_REQUEST');
      expect(body.error).toBe('Malformed JSON in the request body');
      expect(res.text).not.toMatch(/Unexpected|position|SyntaxError/);
    });

    it('POST /api/chat with malformed JSON answers 400 JSON', async () => {
      const res = await server()
        .post('/api/chat')
        .set('x-session-id', 'e5')
        .set('Content-Type', 'application/json')
        .send('{not json')
        .expect(400);

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('POST /api/summary rejects a body that is not an object', async () => {
      const res = await server()
        .post('/api/summary')
        .set('x-session-id', 'e6')
        .set('Content-Type', 'application/json')
        .send('[1, 2, 3]')
        .expect(400);

      expect((res.body as ErrorBody).code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/greeting rejects a body that is not an object', async () => {
      await server()
        .post('/api/greeting')
        .set('x-session-id', 'e7')
        .set('Content-Type', 'application/json')
        .send('"hello"')
        .expect(400);
    });

    it('still accepts an empty body on summary and greeting', async () => {
      await server()
        .post('/api/summary')
        .set('x-session-id', 'e8')
        .send({})
        .expect(200);
      await server()
        .post('/api/greeting')
        .set('x-session-id', 'e8')
        .expect(200);
    });
  });

  describe('rate limiting', () => {
    it('answers the 11th request with a friendly 429 { error, code }', async () => {
      for (let i = 1; i <= 10; i++) {
        await server()
          .post('/api/greeting')
          .set('x-session-id', 'e-limit')
          .expect(200);
      }

      const res = await server()
        .post('/api/greeting')
        .set('x-session-id', 'e-limit')
        .expect(429);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(res.body).toEqual({
        error: 'Too many requests. Please wait a minute and try again.',
        code: 'RATE_LIMITED',
      });
    });
  });

  describe('unexpected errors', () => {
    it('answers 500 INTERNAL_ERROR without leaking the cause or a stack', async () => {
      const res = await server().get('/api/boom').expect(500);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toEqual({
        error: 'Something went wrong on our side. Please try again.',
        code: 'INTERNAL_ERROR',
      });
      expect(res.text).not.toMatch(/hunter2|secret\.ts|stack|node_modules/);
    });
  });

  describe('when the AI service is down', () => {
    let downApp: INestApplication<App>;

    beforeAll(async () => {
      downApp = await createApp(DEAD_PORT);
    });

    afterAll(async () => {
      await downApp.close();
    });

    it('answers 503 SERVICE_UNAVAILABLE instead of a raw 500', async () => {
      const res = await request(downApp.getHttpServer())
        .get('/api/approvals')
        .expect(503);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = res.body as ErrorBody;
      expect(body.code).toBe('SERVICE_UNAVAILABLE');
      expect(res.text).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|4198/);
    });

    it('does the same for the AI routes', async () => {
      const res = await request(downApp.getHttpServer())
        .post('/api/summary')
        .set('x-session-id', 'down-1')
        .send({})
        .expect(503);

      expect((res.body as ErrorBody).code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('every error response', () => {
    it('is JSON with { error, code } and never a stack trace', async () => {
      const responses = await Promise.all([
        server().get('/api/nope'),
        server().post('/api/help').set('x-session-id', 'e9').send({}),
        server().get('/api/boom'),
      ]);

      for (const res of responses) {
        expect(res.headers['content-type']).toMatch(/application\/json/);
        const body = res.body as ErrorBody;
        expect(typeof body.error).toBe('string');
        expect(typeof body.code).toBe('string');
        expect(res.text).not.toMatch(/stack|node_modules|\bat\s+\S+\s+\(/i);
      }
    });
  });
});
