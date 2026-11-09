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
import { GreetingPtrn } from './../src/messagepattern';

const STUB_PORT = 4108;

const STUB_GREETING = {
  text: 'Welcome back! 4 approvals are waiting for you.',
  source: 'ai',
};

/** Stands in for ai-assistant-service, over a real TCP socket. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: GreetingPtrn })
  getGreeting(@Payload() payload: { locale?: string } | undefined) {
    // echoes the locale it received, so a test can see what was forwarded
    return payload?.locale
      ? { ...STUB_GREETING, text: `locale:${payload.locale}` }
      : STUB_GREETING;
  }
}

describe('POST /api/greeting (e2e)', () => {
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

  it('returns 200 (not 201) with the greeting from the AI service', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/greeting')
      .set('x-session-id', 'test-1')
      .send({})
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual(STUB_GREETING);
  });

  it("forwards the operator's language to the AI service", async () => {
    const res = await request(app.getHttpServer())
      .post('/api/greeting')
      .set('x-session-id', 'locale-1')
      .send({ locale: 'hi-IN' })
      .expect(200);

    expect((res.body as { text: string }).text).toBe('locale:hi-IN');
  });

  it('works without a body or a session header', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/greeting')
      .expect(200);

    expect(typeof (res.body as { text: unknown }).text).toBe('string');
  });

  it('is rate limited: the 11th request in a minute returns 429', async () => {
    for (let i = 1; i <= 10; i++) {
      await request(app.getHttpServer())
        .post('/api/greeting')
        .set('x-session-id', 'greeting-limit')
        .expect(200);
    }

    const res = await request(app.getHttpServer())
      .post('/api/greeting')
      .set('x-session-id', 'greeting-limit')
      .expect(429);

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
