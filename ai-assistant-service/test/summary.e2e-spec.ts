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
import { SummaryResponse } from './../src/contracts/schemas';
import { SummaryPtrn } from './../src/messagepattern';
import { getMicroserviceOptions } from './../src/microservice.options';

const mockChat = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: jest.fn(),
  })),
}));

const TEST_PORT = 4104;

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

function cohereReply(text: string) {
  return { message: { content: [{ type: 'text', text }] } };
}

describe('Summary message pattern (e2e over TCP)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  const requestSummary = (payload: unknown = {}) =>
    firstValueFrom(client.send<SummaryResponse>({ cmd: SummaryPtrn }, payload));

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

  it('returns the AI summary (source "ai") when Cohere answers with valid JSON', async () => {
    mockChat.mockResolvedValue(cohereReply(JSON.stringify(aiSummary)));

    const result = await requestSummary();

    expect(SummaryResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBe('ai');
    expect(result.items).toHaveLength(4);
  });

  it("asks Cohere for the operator's language and accepts the translated summary", async () => {
    const spanish = {
      ...aiSummary,
      headline: 'Cuatro aprobaciones pendientes.',
    };
    mockChat.mockResolvedValue(cohereReply(JSON.stringify(spanish)));

    const result = await requestSummary({ locale: 'es' });

    expect(result.source).toBe('ai');
    expect(result.headline).toBe('Cuatro aprobaciones pendientes.');
    const [body] = mockChat.mock.calls[0] as [
      { messages: { role: string; content: string }[] },
    ];
    expect(JSON.stringify(body.messages)).toContain('Spanish');
  });

  it('rejects an invalid locale before calling the model', async () => {
    await expect(
      requestSummary({ locale: 'not a locale!' }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('returns the fallback (source "fallback") when the LLM times out', async () => {
    mockChat.mockReturnValue(new Promise(() => {})); // never answers

    const result = await requestSummary();

    expect(SummaryResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBe('fallback');
    expect(result.items).toHaveLength(4);
  });

  it('returns the fallback when Cohere rejects (e.g. a bad API key)', async () => {
    mockChat.mockRejectedValue(new Error('401 invalid api token'));

    const result = await requestSummary();

    expect(result.source).toBe('fallback');
    expect(result.items).toHaveLength(4);
  });

  it('returns the fallback when Cohere returns malformed JSON', async () => {
    mockChat.mockResolvedValue(cohereReply('{"headline": "cut off'));

    const result = await requestSummary();

    expect(result.source).toBe('fallback');
  });

  it('returns the fallback when FORCE_LLM_FAILURE is on, without calling Cohere', async () => {
    process.env.FORCE_LLM_FAILURE = 'true';

    const result = await requestSummary();

    expect(result.source).toBe('fallback');
    expect(mockChat).not.toHaveBeenCalled();
  });
});
