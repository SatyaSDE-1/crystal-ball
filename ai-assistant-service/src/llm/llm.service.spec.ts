import { ConfigService } from '@nestjs/config';
import { LlmError, LlmTimeoutError } from './llm.errors';
import { LlmRequest } from './llm.provider';
import { LlmService } from './llm.service';

const mockChat = jest.fn();
const mockChatStream = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClientV2: jest.fn().mockImplementation(() => ({
    chat: mockChat,
    chatStream: mockChatStream,
  })),
}));

const request: LlmRequest = {
  system: 'You are helpful.',
  messages: [{ role: 'user', content: 'Say hi' }],
};

function buildService(env: Record<string, string> = {}) {
  const values: Record<string, string> = {
    COHERE_API_KEY: 'test-key',
    COHERE_MODEL: 'command-a-03-2025',
    LLM_TIMEOUT_MS: '8000',
    ...env,
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;

  return new LlmService(config);
}

function cohereReply(text: string) {
  return { message: { content: [{ type: 'text', text }] } };
}

function deltaEvent(text: string) {
  return {
    type: 'content-delta',
    delta: { message: { content: { text } } },
  };
}

async function* eventsOf(events: unknown[]) {
  for (const event of events) {
    await Promise.resolve();
    yield event;
  }
}

async function collect(source: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of source) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('LlmService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('complete()', () => {
    it('returns the text on success', async () => {
      mockChat.mockResolvedValue(cohereReply('hi there'));

      await expect(buildService().complete(request)).resolves.toBe('hi there');
    });

    it('sends the model, the system prompt and the messages to Cohere', async () => {
      mockChat.mockResolvedValue(cohereReply('ok'));

      await buildService().complete(request);

      expect(mockChat).toHaveBeenCalledWith(
        {
          model: 'command-a-03-2025',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Say hi' },
          ],
        },
        expect.objectContaining({
          abortSignal: expect.any(AbortSignal) as AbortSignal,
        }),
      );
    });

    it('passes the temperature to Cohere when one is requested', async () => {
      mockChat.mockResolvedValue(cohereReply('ok'));

      await buildService().complete({ ...request, temperature: 1 });

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 1 }),
        expect.anything(),
      );
    });

    it('does not send a temperature when none is requested', async () => {
      mockChat.mockResolvedValue(cohereReply('ok'));

      await buildService().complete(request);

      const [body] = mockChat.mock.calls[0] as [Record<string, unknown>];
      expect(body).not.toHaveProperty('temperature');
    });

    it('rejects with LlmTimeoutError after LLM_TIMEOUT_MS', async () => {
      jest.useFakeTimers();
      mockChat.mockReturnValue(new Promise(() => {})); // never settles

      const result = buildService({ LLM_TIMEOUT_MS: '5000' }).complete(request);
      const assertion = expect(result).rejects.toBeInstanceOf(LlmTimeoutError);

      await jest.advanceTimersByTimeAsync(5000);
      await assertion;
    });

    it('does not time out before LLM_TIMEOUT_MS', async () => {
      jest.useFakeTimers();
      let resolveChat: (value: unknown) => void = () => {};
      mockChat.mockReturnValue(
        new Promise((resolve) => {
          resolveChat = resolve;
        }),
      );

      const result = buildService({ LLM_TIMEOUT_MS: '5000' }).complete(request);
      await jest.advanceTimersByTimeAsync(4999);
      resolveChat(cohereReply('just in time'));

      await expect(result).resolves.toBe('just in time');
    });

    it('aborts the underlying request when it times out', async () => {
      jest.useFakeTimers();
      mockChat.mockReturnValue(new Promise(() => {}));

      const result = buildService({ LLM_TIMEOUT_MS: '1000' }).complete(request);
      const assertion = expect(result).rejects.toBeInstanceOf(LlmTimeoutError);
      await jest.advanceTimersByTimeAsync(1000);
      await assertion;

      const [, options] = mockChat.mock.calls[0] as [
        unknown,
        { abortSignal: AbortSignal },
      ];
      expect(options.abortSignal.aborted).toBe(true);
    });

    it('rejects with LlmError when the SDK fails', async () => {
      mockChat.mockRejectedValue(new Error('401 invalid api token'));

      const error: unknown = await buildService()
        .complete(request)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(LlmError);
      expect(error).not.toBeInstanceOf(LlmTimeoutError);
      expect((error as LlmError).message).toContain('401 invalid api token');
    });

    it('rejects with LlmError when Cohere returns no text', async () => {
      mockChat.mockResolvedValue({ message: { content: [] } });

      await expect(buildService().complete(request)).rejects.toBeInstanceOf(
        LlmError,
      );
    });

    it('rejects with LlmError when the API key is missing, without calling Cohere', async () => {
      const service = buildService({ COHERE_API_KEY: '' });

      await expect(service.complete(request)).rejects.toBeInstanceOf(LlmError);
      expect(mockChat).not.toHaveBeenCalled();
    });
  });

  describe('stream()', () => {
    it('yields the token chunks', async () => {
      mockChatStream.mockResolvedValue(
        eventsOf([
          { type: 'message-start' },
          deltaEvent('Hel'),
          deltaEvent('lo'),
          deltaEvent(' there'),
          { type: 'message-end' },
        ]),
      );

      await expect(collect(buildService().stream(request))).resolves.toEqual([
        'Hel',
        'lo',
        ' there',
      ]);
    });

    it('rejects with LlmError when the SDK fails to open the stream', async () => {
      mockChatStream.mockRejectedValue(new Error('network down'));

      await expect(
        collect(buildService().stream(request)),
      ).rejects.toBeInstanceOf(LlmError);
    });

    it('rejects with LlmTimeoutError when no token arrives in time', async () => {
      jest.useFakeTimers();
      mockChatStream.mockReturnValue(new Promise(() => {}));

      const result = collect(
        buildService({ LLM_TIMEOUT_MS: '3000' }).stream(request),
      );
      const assertion = expect(result).rejects.toBeInstanceOf(LlmTimeoutError);

      await jest.advanceTimersByTimeAsync(3000);
      await assertion;
    });
  });

  describe('FORCE_LLM_FAILURE', () => {
    it('makes complete() throw LlmError without calling Cohere', async () => {
      const service = buildService({ FORCE_LLM_FAILURE: 'true' });

      await expect(service.complete(request)).rejects.toBeInstanceOf(LlmError);
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('makes stream() throw LlmError without calling Cohere', async () => {
      const service = buildService({ FORCE_LLM_FAILURE: 'true' });

      await expect(collect(service.stream(request))).rejects.toBeInstanceOf(
        LlmError,
      );
      expect(mockChatStream).not.toHaveBeenCalled();
    });

    it('is off unless the value is exactly "true"', async () => {
      mockChat.mockResolvedValue(cohereReply('fine'));
      const service = buildService({ FORCE_LLM_FAILURE: 'false' });

      await expect(service.complete(request)).resolves.toBe('fine');
    });
  });
});
