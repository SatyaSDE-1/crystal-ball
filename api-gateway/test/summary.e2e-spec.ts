import {
  Controller,
  INestApplication,
  INestMicroservice,
} from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { SummaryPtrn } from './../src/messagepattern';

const STUB_PORT = 4105;

const STUB_SUMMARY = {
  headline: 'Four approvals await review.',
  items: [
    { id: 'apr-3', urgency: 'high', reason: 'Safety specs.' },
    { id: 'apr-1', urgency: 'medium', reason: 'Onboarding.' },
    { id: 'apr-4', urgency: 'medium', reason: 'Layout.' },
    { id: 'apr-2', urgency: 'low', reason: 'Demo video.' },
  ],
  source: 'fallback',
};

/** Stands in for ai-assistant-service, over a real TCP socket. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: SummaryPtrn })
  getSummary(@Payload() payload: { locale?: string } | undefined) {
    // echoes the locale it received, so a test can see what was forwarded
    return payload?.locale
      ? { ...STUB_SUMMARY, headline: `locale:${payload.locale}` }
      : STUB_SUMMARY;
  }
}

describe('POST /api/summary (e2e)', () => {
  let app: INestApplication<App>;
  let stub: INestMicroservice;

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
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
  });

  it('returns 200 (not 201) with the summary from the AI service', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/summary')
      .set('x-session-id', 'test-1')
      .send({})
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(STUB_SUMMARY);
  });

  it("forwards the operator's language to the AI service", async () => {
    const res = await request(app.getHttpServer())
      .post('/api/summary')
      .set('x-session-id', 'locale-1')
      .send({ locale: 'es' })
      .expect(200);

    expect((res.body as { headline: string }).headline).toBe('locale:es');
  });

  it('answers 400 for a locale that is not a language code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/summary')
      .set('x-session-id', 'locale-2')
      .send({ locale: 'not a locale!' })
      .expect(400);

    expect((res.body as { errors: { field: string }[] }).errors[0].field).toBe(
      'locale',
    );
  });

  it('works without a body or a session header', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/summary')
      .expect(200);

    expect(typeof (res.body as { headline: unknown }).headline).toBe('string');
  });
});
