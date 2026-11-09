import {
  Controller,
  Get,
  INestApplication,
  INestMicroservice,
  UseGuards,
} from '@nestjs/common';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { ApprovalsPtrn, SummaryPtrn } from './../src/messagepattern';
import { RateLimitModule } from './../src/rate-limit/rate-limit.module';
import { SessionThrottlerGuard } from './../src/rate-limit/session-throttler.guard';

const STUB_PORT = 4106;

/** Stands in for ai-assistant-service, over a real TCP socket. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: SummaryPtrn })
  getSummary() {
    return { headline: 'ok', items: [], source: 'fallback' };
  }

  @MessagePattern({ cmd: ApprovalsPtrn })
  getApprovals() {
    return [];
  }
}

/** A second guarded route, to prove the budget is shared across AI routes. */
@Controller('probe')
@UseGuards(SessionThrottlerGuard)
class ProbeController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let stub: INestMicroservice;

  const postSummary = (sessionId?: string) => {
    const req = request(app.getHttpServer()).post('/api/summary');
    return sessionId ? req.set('x-session-id', sessionId) : req;
  };

  beforeAll(async () => {
    const stubModule = await Test.createTestingModule({
      controllers: [StubAiAssistantController],
    }).compile();
    stub = stubModule.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: STUB_PORT },
    });
    await stub.listen();

    process.env.AI_ASSISTANT_HOST = '127.0.0.1';
    process.env.AI_ASSISTANT_PORT = String(STUB_PORT);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, RateLimitModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
  });

  it('allows 10 requests a minute, then answers the 11th with a 429 JSON body', async () => {
    for (let i = 1; i <= 10; i++) {
      await postSummary('limit-test').expect(200);
    }

    const res = await postSummary('limit-test').expect(429);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ code: 'RATE_LIMITED' });
    expect(typeof (res.body as { error: unknown }).error).toBe('string');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('limits each x-session-id separately', async () => {
    for (let i = 1; i <= 11; i++) {
      await postSummary('session-a');
    }
    await postSummary('session-a').expect(429);

    await postSummary('session-b').expect(200);
  });

  it('falls back to the client IP when there is no x-session-id', async () => {
    for (let i = 1; i <= 10; i++) {
      await postSummary().expect(200);
    }

    await postSummary().expect(429);
  });

  it('shares one budget across AI routes for the same session', async () => {
    for (let i = 1; i <= 10; i++) {
      await postSummary('shared-budget').expect(200);
    }

    await request(app.getHttpServer())
      .get('/api/probe')
      .set('x-session-id', 'shared-budget')
      .expect(429);
  });

  it('never rate limits GET /api/approvals', async () => {
    for (let i = 1; i <= 15; i++) {
      await request(app.getHttpServer())
        .get('/api/approvals')
        .set('x-session-id', 'approvals-test')
        .expect(200);
    }
  });
});
