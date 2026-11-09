import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { AppModule } from './../src/app.module';
import { GreetingResponse } from './../src/contracts/schemas';
import { GreetingPtrn } from './../src/messagepattern';
import { getMicroserviceOptions } from './../src/microservice.options';

const mockChat = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: jest.fn(),
  })),
}));

const TEST_PORT = 4107;

function cohereReply(text: string) {
  return { message: { content: [{ type: 'text', text }] } };
}

describe('Greeting message pattern (e2e over TCP)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  const requestGreeting = () =>
    firstValueFrom(client.send<GreetingResponse>({ cmd: GreetingPtrn }, {}));

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
    mockChat.mockReset();
    delete process.env.FORCE_LLM_FAILURE;
  });

  it('returns an AI greeting that mentions the pending count', async () => {
    mockChat.mockResolvedValue(
      cohereReply('Welcome back! 4 approvals are waiting for you.'),
    );

    const result = await requestGreeting();

    expect(GreetingResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBe('ai');
    expect(result.text).toContain('4');
  });

  it('regenerates: two requests give two different greetings', async () => {
    mockChat
      .mockResolvedValueOnce(cohereReply('Hello! 4 approvals await.'))
      .mockResolvedValueOnce(cohereReply('Hi again, 4 items need you.'));

    const first = await requestGreeting();
    const second = await requestGreeting();

    expect(first.text).not.toBe(second.text);
  });

  it('returns "You have 4 approvals pending." (fallback) when the LLM times out', async () => {
    mockChat.mockReturnValue(new Promise(() => {})); // never answers

    await expect(requestGreeting()).resolves.toEqual({
      text: 'You have 4 approvals pending.',
      source: 'fallback',
    });
  });

  it('returns the fallback when Cohere rejects (e.g. a bad API key)', async () => {
    mockChat.mockRejectedValue(new Error('401 invalid api token'));

    await expect(requestGreeting()).resolves.toEqual({
      text: 'You have 4 approvals pending.',
      source: 'fallback',
    });
  });

  it('returns the fallback when FORCE_LLM_FAILURE is on, without calling Cohere', async () => {
    process.env.FORCE_LLM_FAILURE = 'true';

    await expect(requestGreeting()).resolves.toEqual({
      text: 'You have 4 approvals pending.',
      source: 'fallback',
    });
    expect(mockChat).not.toHaveBeenCalled();
  });
});
