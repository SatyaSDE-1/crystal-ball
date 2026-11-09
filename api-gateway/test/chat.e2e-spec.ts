import {
  Controller,
  INestApplication,
  INestMicroservice,
} from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { from } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { ChatPtrn } from './../src/messagepattern';

const STUB_PORT = 4112;
const DEAD_PORT = 4199; // nothing listens here

interface ChatPayload {
  sessionId: string;
  mode: string;
  messages: { role: string; content: string }[];
}

/** Stands in for ai-assistant-service, streaming events over real TCP. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: ChatPtrn })
  chat(@Payload() payload: ChatPayload) {
    if (payload.sessionId === 'ai-fails') {
      return from([
        { type: 'token', text: 'Par' },
        { type: 'error', message: 'Sorry, something went wrong.' },
      ]);
    }
    const last = payload.messages.at(-1)?.content ?? '';
    return from([
      { type: 'token', text: `${payload.mode}:` },
      { type: 'token', text: ` ${last}` },
      { type: 'done' },
    ]);
  }
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

function parseEvents(raw: string) {
  return raw
    .split('\n\n')
    .filter(Boolean)
    .map((frame) => {
      const event = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      return { event, data: JSON.parse(data ?? 'null') as unknown };
    });
}

const talkBody = {
  sessionId: 'test-1',
  mode: 'talk',
  messages: [{ role: 'user', content: 'Which approval is first?' }],
};

async function createApp(aiPort: number): Promise<INestApplication<App>> {
  process.env.AI_ASSISTANT_HOST = '127.0.0.1';
  process.env.AI_ASSISTANT_PORT = String(aiPort);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('POST /api/chat (SSE, e2e)', () => {
  let app: INestApplication<App>;
  let stub: INestMicroservice;

  const post = (
    body: unknown,
    target: INestApplication<App> = app,
    session = 'test-1',
  ) =>
    request(target.getHttpServer())
      .post('/api/chat')
      .set('x-session-id', session)
      .send(body as object)
      .buffer(true)
      .parse(textParser);

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

  it('answers 200 with the SSE headers', async () => {
    const res = await post(talkBody).expect(200);

    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['connection']).toBe('keep-alive');
  });

  it('emits token events, then a done event, then closes', async () => {
    const res = await post(talkBody).expect(200);

    const events = parseEvents(res.body as string);
    expect(events.map((e) => e.event)).toEqual(['token', 'token', 'done']);
    expect(events[0].data).toEqual({ text: 'talk:' });
    expect(events[1].data).toEqual({ text: ' Which approval is first?' });
  });

  it('forwards the mode and the conversation to the AI service', async () => {
    const res = await post({
      sessionId: 'test-1',
      mode: 'teach',
      messages: [
        { role: 'user', content: 'How do I review a PDF?' },
        { role: 'assistant', content: 'Open it first.' },
        { role: 'user', content: 'Explain step 2 simpler' },
      ],
    }).expect(200);

    const [first, second] = parseEvents(res.body as string);
    expect(first.data).toEqual({ text: 'teach:' });
    expect(second.data).toEqual({ text: ' Explain step 2 simpler' });
  });

  it('forwards an error event from the AI service and still closes cleanly', async () => {
    const res = await post({ ...talkBody, sessionId: 'ai-fails' }, app, 'f1');

    const events = parseEvents(res.body as string);
    expect(res.status).toBe(200);
    expect(events.map((e) => e.event)).toEqual(['token', 'error']);
    expect(events[1].data).toEqual({ message: 'Sorry, something went wrong.' });
  });

  describe('validation (before any stream opens)', () => {
    it('answers 400 JSON with field errors for an unknown mode', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/chat')
        .set('x-session-id', 'v1')
        .send({ ...talkBody, mode: 'banana' })
        .expect(400);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = res.body as { errors: { field: string }[] };
      expect(body.errors.map((e) => e.field)).toContain('mode');
    });

    it('answers 400 for an empty body', async () => {
      await request(app.getHttpServer())
        .post('/api/chat')
        .set('x-session-id', 'v2')
        .send({})
        .expect(400);
    });

    it('answers 400 when the last message is from the assistant', async () => {
      await request(app.getHttpServer())
        .post('/api/chat')
        .set('x-session-id', 'v3')
        .send({
          ...talkBody,
          messages: [{ role: 'assistant', content: 'Hello!' }],
        })
        .expect(400);
    });
  });

  it('is rate limited: the 11th request in a minute returns 429 JSON', async () => {
    for (let i = 1; i <= 10; i++) {
      await post(talkBody, app, 'chat-limit').expect(200);
    }

    const res = await request(app.getHttpServer())
      .post('/api/chat')
      .set('x-session-id', 'chat-limit')
      .send(talkBody)
      .expect(429);

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  describe('when the AI service is down', () => {
    let downApp: INestApplication<App>;

    beforeAll(async () => {
      downApp = await createApp(DEAD_PORT);
    });

    afterAll(async () => {
      await downApp.close();
    });

    it('sends a friendly error event and closes, instead of a 500 or a hang', async () => {
      const res = await post(talkBody, downApp, 'down-1');

      const events = parseEvents(res.body as string);
      expect(res.status).toBe(200);
      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('error');
      const { message } = events[0].data as { message: string };
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|4199/);
    });
  });
});
