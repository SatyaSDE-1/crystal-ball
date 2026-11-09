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
import { HelpResponse } from './../src/contracts/schemas';
import { HelpPtrn } from './../src/messagepattern';
import { getMicroserviceOptions } from './../src/microservice.options';

const mockChat = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: jest.fn(),
  })),
}));

const TEST_PORT = 4109;
const REJECTION_QUESTION = 'What are the rejection criteria?';
const REJECTION_TEXT = 'Reject an item when the file is corrupt';

function cohereReply(text: string) {
  return { message: { content: [{ type: 'text', text }] } };
}

describe('Help message pattern (e2e over TCP)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  const askHelp = (payload: unknown) =>
    firstValueFrom(client.send<HelpResponse>({ cmd: HelpPtrn }, payload));

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

  it('answers a grounded question from the policy, with citations (Test 6)', async () => {
    mockChat.mockResolvedValue(
      cohereReply('Reject items that are corrupt or cannot be opened.'),
    );

    const result = await askHelp({ question: REJECTION_QUESTION });

    expect(HelpResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBe('ai');
    expect(result.answer).toContain('corrupt');
    expect(result.citations).toContain('rejection-criteria');
  });

  it('sends only the retrieved policy chunks to the model', async () => {
    mockChat.mockResolvedValue(cohereReply('Reject corrupt files.'));

    await askHelp({ question: REJECTION_QUESTION });

    const [body] = mockChat.mock.calls[0] as [
      { messages: { role: string; content: string }[] },
    ];
    const userMessage = body.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).toContain(REJECTION_TEXT);
    expect(userMessage?.content).not.toContain('Standard items are reviewed');
  });

  it('says "not covered" with empty citations, without calling the model (Test 7)', async () => {
    const result = await askHelp({
      question: 'What is the capital of France?',
    });

    expect(result.answer).toBe('Not covered in the policy note');
    expect(result.citations).toEqual([]);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('falls back to the top chunk verbatim when the LLM times out', async () => {
    mockChat.mockReturnValue(new Promise(() => {})); // never answers

    const result = await askHelp({ question: REJECTION_QUESTION });

    expect(result.source).toBe('fallback');
    expect(result.answer).toContain(REJECTION_TEXT);
    expect(result.citations).toEqual(['rejection-criteria']);
  });

  it('falls back when Cohere rejects (e.g. a bad API key)', async () => {
    mockChat.mockRejectedValue(new Error('401 invalid api token'));

    const result = await askHelp({ question: REJECTION_QUESTION });

    expect(result.source).toBe('fallback');
    expect(result.citations).toEqual(['rejection-criteria']);
  });

  it('falls back when FORCE_LLM_FAILURE is on, without calling Cohere', async () => {
    process.env.FORCE_LLM_FAILURE = 'true';

    const result = await askHelp({ question: REJECTION_QUESTION });

    expect(result.source).toBe('fallback');
    expect(result.answer).toContain(REJECTION_TEXT);
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('rejects a payload that is not a valid HelpRequest', async () => {
    await expect(askHelp({ question: 'hi' })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(askHelp({})).rejects.toMatchObject({ statusCode: 400 });
  });
});
