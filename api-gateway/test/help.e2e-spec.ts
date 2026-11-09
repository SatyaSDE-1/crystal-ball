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
import { HelpPtrn } from './../src/messagepattern';

const STUB_PORT = 4110;

/** Stands in for ai-assistant-service; echoes the question it received. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: HelpPtrn })
  getHelp(@Payload() payload: { question: string }) {
    return {
      answer: `You asked: ${payload.question}`,
      citations: ['rejection-criteria'],
      source: 'ai',
    };
  }
}

describe('POST /api/help (e2e)', () => {
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

  it('returns 200 (not 201) and forwards the question to the AI service', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/help')
      .set('x-session-id', 'test-1')
      .send({ question: 'What are the rejection criteria?' })
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      answer: 'You asked: What are the rejection criteria?',
      citations: ['rejection-criteria'],
      source: 'ai',
    });
  });

  it('is rate limited: the 11th request in a minute returns 429', async () => {
    for (let i = 1; i <= 10; i++) {
      await request(app.getHttpServer())
        .post('/api/help')
        .set('x-session-id', 'help-limit')
        .send({ question: 'What is the SLA?' })
        .expect(200);
    }

    const res = await request(app.getHttpServer())
      .post('/api/help')
      .set('x-session-id', 'help-limit')
      .send({ question: 'What is the SLA?' })
      .expect(429);

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
