import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom, toArray } from 'rxjs';
import { AppModule } from './../src/app.module';
import { ChatEvent, FRIENDLY_ERROR_MESSAGE } from './../src/chat/chat.events';
import { ChatPtrn } from './../src/messagepattern';
import { getMicroserviceOptions } from './../src/microservice.options';

const mockChatStream = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: jest.fn(),
    chatStream: mockChatStream,
  })),
}));

const TEST_PORT = 4111;

function delta(text: string) {
  return { type: 'content-delta', delta: { message: { content: { text } } } };
}

async function* cohereStream(...texts: string[]) {
  yield { type: 'message-start' };
  for (const text of texts) {
    await Promise.resolve();
    yield delta(text);
  }
  yield { type: 'message-end' };
}

const talkBody = {
  sessionId: 'test-1',
  mode: 'talk',
  messages: [
    {
      role: 'user',
      content: 'Which approval needs my attention first and why?',
    },
  ],
};

describe('Chat message pattern (e2e over TCP, streaming)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  const chat = (payload: unknown) =>
    firstValueFrom(
      client.send<ChatEvent>({ cmd: ChatPtrn }, payload).pipe(toArray()),
    );

  beforeAll(async () => {
    process.env.TCP_HOST = '127.0.0.1';
    process.env.TCP_PORT = String(TEST_PORT);
    process.env.COHERE_API_KEY = 'test-key';
    process.env.LLM_TIMEOUT_MS = '150';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.connectMicroservice(getMicroserviceOptions(app.get(ConfigService)));
    await app.startAllMicroservices();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: TEST_PORT },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  beforeEach(() => {
    mockChatStream.mockReset();
    delete process.env.FORCE_LLM_FAILURE;
  });

  it('streams token events, then a done event (Test 8, talk)', async () => {
    mockChatStream.mockResolvedValue(
      cohereStream('Safety', ' specs', ' first'),
    );

    const events = await chat(talkBody);

    expect(events).toEqual([
      { type: 'token', text: 'Safety' },
      { type: 'token', text: ' specs' },
      { type: 'token', text: ' first' },
      { type: 'done' },
    ]);
  });

  it('uses the teach prompt in teach mode (Test 8b)', async () => {
    mockChatStream.mockResolvedValue(cohereStream('Step 1.'));

    await chat({
      ...talkBody,
      mode: 'teach',
      messages: [{ role: 'user', content: 'How do I review a PDF?' }],
    });

    const [body] = mockChatStream.mock.calls[0] as [
      { messages: { role: string; content: string }[] },
    ];
    const system = body.messages.find((m) => m.role === 'system');
    expect(system?.content).toContain('trainer');
  });

  it('sends the earlier turns of a follow-up to the model (Test 8b)', async () => {
    mockChatStream.mockResolvedValue(cohereStream('Simpler.'));

    await chat({
      sessionId: 'test-1',
      mode: 'teach',
      messages: [
        { role: 'user', content: 'How do I review a PDF?' },
        { role: 'assistant', content: '1. Open it. 2. Check the pages.' },
        { role: 'user', content: 'Explain step 2 simpler' },
      ],
    });

    const [body] = mockChatStream.mock.calls[0] as [
      { messages: { role: string; content: string }[] },
    ];
    const text = JSON.stringify(body.messages);
    expect(text).toContain('1. Open it. 2. Check the pages.');
    expect(text).toContain('Explain step 2 simpler');
  });

  it('injects the approvals into the prompt', async () => {
    mockChatStream.mockResolvedValue(cohereStream('ok'));

    await chat(talkBody);

    const [body] = mockChatStream.mock.calls[0] as [{ messages: unknown[] }];
    expect(JSON.stringify(body.messages)).toContain(
      'Safety Equipment & Sensor Specs',
    );
  });

  it('emits a friendly error event and closes when Cohere rejects (Test 8c)', async () => {
    mockChatStream.mockRejectedValue(new Error('401 invalid api token'));

    const events = await chat(talkBody);

    expect(events).toEqual([
      { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
    ]);
  });

  it('emits a friendly error event when the stream stalls past the timeout', async () => {
    mockChatStream.mockReturnValue(new Promise(() => {})); // never answers

    const events = await chat(talkBody);

    expect(events).toEqual([
      { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
    ]);
  });

  it('emits the error event when FORCE_LLM_FAILURE is on, without calling Cohere', async () => {
    process.env.FORCE_LLM_FAILURE = 'true';

    const events = await chat(talkBody);

    expect(events).toEqual([
      { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
    ]);
    expect(mockChatStream).not.toHaveBeenCalled();
  });

  it('rejects an invalid ChatRequest before streaming anything', async () => {
    await expect(chat({ ...talkBody, mode: 'banana' })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(chat({})).rejects.toMatchObject({ statusCode: 400 });
  });
});
