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
import {
  ApprovalsPtrn,
  ChatPtrn,
  GreetingPtrn,
  HelpPtrn,
  SummaryPtrn,
} from './../src/messagepattern';
import { getMicroserviceOptions } from './../src/microservice.options';

const mockChat = jest.fn();
const mockChatStream = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: mockChatStream,
  })),
}));

const TEST_PORT = 4114;

interface Sourced {
  source: string;
}

describe('FORCE_LLM_FAILURE=true: the failure demo (e2e over TCP)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  const send = <T>(cmd: string, payload: unknown = {}) =>
    firstValueFrom(client.send<T>({ cmd }, payload));

  beforeAll(async () => {
    process.env.TCP_HOST = '127.0.0.1';
    process.env.TCP_PORT = String(TEST_PORT);
    process.env.COHERE_API_KEY = 'test-key';
    process.env.FORCE_LLM_FAILURE = 'true';

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
    delete process.env.FORCE_LLM_FAILURE;
    await client.close();
    await app.close();
  });

  it('summary returns the deterministic fallback', async () => {
    const result = await send<Sourced & { items: unknown[] }>(SummaryPtrn);

    expect(result.source).toBe('fallback');
    expect(result.items).toHaveLength(4);
  });

  it('greeting returns "You have 4 approvals pending."', async () => {
    await expect(send(GreetingPtrn)).resolves.toEqual({
      text: 'You have 4 approvals pending.',
      source: 'fallback',
    });
  });

  it('help returns the top policy chunk verbatim, with its citation', async () => {
    const result = await send<
      Sourced & { answer: string; citations: string[] }
    >(HelpPtrn, { question: 'What are the rejection criteria?' });

    expect(result.source).toBe('fallback');
    expect(result.answer).toContain('Reject an item when the file is corrupt');
    expect(result.citations).toEqual(['rejection-criteria']);
  });

  it('help still says "not covered" for an unrelated question', async () => {
    const result = await send<Sourced & { answer: string }>(HelpPtrn, {
      question: 'What is the capital of France?',
    });

    expect(result.answer).toBe('Not covered in the policy note');
  });

  it('chat sends an error event, not tokens', async () => {
    const events = await firstValueFrom(
      client
        .send<{ type: string }>(
          { cmd: ChatPtrn },
          {
            sessionId: 't',
            mode: 'talk',
            messages: [{ role: 'user', content: 'Hi' }],
          },
        )
        .pipe(toArray()),
    );

    expect(events.map((e) => e.type)).toEqual(['error']);
  });

  it('approvals do not need the LLM and keep working', async () => {
    await expect(send<unknown[]>(ApprovalsPtrn)).resolves.toHaveLength(4);
  });

  it('never calls Cohere at all', () => {
    expect(mockChat).not.toHaveBeenCalled();
    expect(mockChatStream).not.toHaveBeenCalled();
  });
});
