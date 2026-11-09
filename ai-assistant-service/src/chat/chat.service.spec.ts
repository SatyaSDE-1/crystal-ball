import { Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { ChatRequest } from '../contracts/schemas';
import { LlmError, LlmTimeoutError } from '../llm/llm.errors';
import { LlmProvider, LlmRequest } from '../llm/llm.provider';
import { chatTalkPromptV1 } from '../prompts/chat-talk.v1';
import { chatTeachPromptV1 } from '../prompts/chat-teach.v1';
import { ChatEvent, FRIENDLY_ERROR_MESSAGE } from './chat.events';
import { ChatService } from './chat.service';

const approvalsService = new ApprovalsService();
const approvals = approvalsService.getApprovals();

async function* tokens(...chunks: string[]) {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
}

async function* failingAfter(chunks: string[], error: Error) {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
  await Promise.resolve();
  throw error;
}

function buildService(stream: jest.Mock) {
  const llm: LlmProvider = { complete: jest.fn(), stream };
  return new ChatService(llm, approvalsService);
}

async function collect(source: AsyncIterable<ChatEvent>) {
  const events: ChatEvent[] = [];
  for await (const event of source) {
    events.push(event);
  }
  return events;
}

const talkRequest: ChatRequest = {
  sessionId: 'test-1',
  mode: 'talk',
  messages: [
    { role: 'user', content: 'Which approval needs my attention first?' },
  ],
};

describe('ChatService', () => {
  beforeEach(() => {
    // Failures log a warning by design; keep test output clean.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('streaming', () => {
    it('emits a token event per chunk, then a done event', async () => {
      const stream = jest.fn(() => tokens('Hel', 'lo', ' there'));

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events).toEqual([
        { type: 'token', text: 'Hel' },
        { type: 'token', text: 'lo' },
        { type: 'token', text: ' there' },
        { type: 'done' },
      ]);
    });

    it('skips empty chunks', async () => {
      const stream = jest.fn(() => tokens('Hi', '', '!'));

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events.filter((e) => e.type === 'token')).toHaveLength(2);
    });
  });

  describe('choosing the prompt by mode', () => {
    it('uses chat-talk.v1 for talk mode', async () => {
      const stream = jest.fn<AsyncGenerator<string>, [LlmRequest]>(() =>
        tokens('ok'),
      );

      await collect(buildService(stream).chat(talkRequest));

      expect(stream.mock.calls[0][0].system).toBe(chatTalkPromptV1.system);
    });

    it('uses chat-teach.v1 for teach mode', async () => {
      const stream = jest.fn<AsyncGenerator<string>, [LlmRequest]>(() =>
        tokens('ok'),
      );

      await collect(
        buildService(stream).chat({
          ...talkRequest,
          mode: 'teach',
          messages: [{ role: 'user', content: 'How do I review a PDF?' }],
        }),
      );

      expect(stream.mock.calls[0][0].system).toBe(chatTeachPromptV1.system);
    });
  });

  describe('building the conversation', () => {
    it('injects the approvals list into the current user message', async () => {
      const stream = jest.fn<AsyncGenerator<string>, [LlmRequest]>(() =>
        tokens('ok'),
      );

      await collect(buildService(stream).chat(talkRequest));

      const { messages } = stream.mock.calls[0][0];
      expect(messages).toEqual([
        {
          role: 'user',
          content: chatTalkPromptV1.buildUserPrompt({
            approvals,
            question: 'Which approval needs my attention first?',
          }),
        },
      ]);
      expect(messages[0].content).toContain('Safety Equipment & Sensor Specs');
    });

    it('keeps earlier turns as they were and wraps only the latest question', async () => {
      const stream = jest.fn<AsyncGenerator<string>, [LlmRequest]>(() =>
        tokens('ok'),
      );

      await collect(
        buildService(stream).chat({
          sessionId: 'test-1',
          mode: 'teach',
          messages: [
            { role: 'user', content: 'How do I review a PDF?' },
            { role: 'assistant', content: '1. Open it. 2. Check the pages.' },
            { role: 'user', content: 'Explain step 2 simpler' },
          ],
        }),
      );

      const { messages } = stream.mock.calls[0][0];
      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        role: 'user',
        content: 'How do I review a PDF?',
      });
      expect(messages[1]).toEqual({
        role: 'assistant',
        content: '1. Open it. 2. Check the pages.',
      });
      expect(messages[2].role).toBe('user');
      expect(messages[2].content).toContain('Explain step 2 simpler');
      expect(messages[2].content).toContain('Safety Equipment & Sensor Specs');
    });

    it('sends only the most recent 20 messages of a long conversation', async () => {
      const stream = jest.fn<AsyncGenerator<string>, [LlmRequest]>(() =>
        tokens('ok'),
      );
      const history = Array.from({ length: 31 }, (_, i) => ({
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `message ${i}`,
      }));

      await collect(
        buildService(stream).chat({
          sessionId: 'test-1',
          mode: 'talk',
          messages: history,
        }),
      );

      const { messages } = stream.mock.calls[0][0];
      expect(messages.length).toBeLessThanOrEqual(20);
      expect(messages[0].role).toBe('user'); // never starts mid-exchange
      expect(messages.at(-1)?.content).toContain('message 30');
    });
  });

  describe('failure handling (never throws, closes cleanly)', () => {
    it('emits one friendly error event when the LLM fails to start', async () => {
      const stream = jest.fn(() => {
        throw new LlmError('401 invalid api token');
      });

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events).toEqual([
        { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
      ]);
    });

    it('emits a friendly error event on an LLM timeout', async () => {
      const stream = jest.fn(() => failingAfter([], new LlmTimeoutError(8000)));

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events).toEqual([
        { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
      ]);
    });

    it('keeps the tokens already sent, then emits the error (no done)', async () => {
      const stream = jest.fn(() =>
        failingAfter(['Hel', 'lo'], new LlmError('connection reset')),
      );

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events).toEqual([
        { type: 'token', text: 'Hel' },
        { type: 'token', text: 'lo' },
        { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
      ]);
    });

    it('emits an error when the model returns nothing at all', async () => {
      const stream = jest.fn(() => tokens());

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events).toEqual([
        { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
      ]);
    });

    it('turns an unexpected error into the same friendly error event', async () => {
      const stream = jest.fn(() =>
        failingAfter([], new TypeError('boom: internal detail')),
      );

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(events).toEqual([
        { type: 'error', message: FRIENDLY_ERROR_MESSAGE },
      ]);
    });

    it('never leaks internal error text to the client', async () => {
      const stream = jest.fn(() =>
        failingAfter([], new LlmError('401 invalid api token sk-secret')),
      );

      const events = await collect(buildService(stream).chat(talkRequest));

      expect(JSON.stringify(events)).not.toContain('sk-secret');
      expect(JSON.stringify(events)).not.toContain('401');
    });
  });
});
