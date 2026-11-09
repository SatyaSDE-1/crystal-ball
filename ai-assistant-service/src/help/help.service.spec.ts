import { Logger } from '@nestjs/common';
import { HelpResponse } from '../contracts/schemas';
import { LlmError, LlmTimeoutError } from '../llm/llm.errors';
import { LlmProvider } from '../llm/llm.provider';
import { helpPromptV1, NOT_COVERED_ANSWER } from '../prompts/help.v1';
import { PolicyChunk } from '../prompts/types';
import { RetrievalService } from '../retrieval/retrieval.service';
import { HelpService } from './help.service';

const rejection: PolicyChunk = {
  id: 'rejection-criteria',
  heading: 'Rejection Criteria',
  text: 'Reject an item when the file is corrupt or cannot be opened.',
};
const escalation: PolicyChunk = {
  id: 'escalation',
  heading: 'Escalation',
  text: 'Escalate to the Safety Lead when an item affects safety.',
};
const sla: PolicyChunk = {
  id: 'sla',
  heading: 'SLA',
  text: 'Standard items are reviewed within two business days.',
};

function buildService(complete: jest.Mock, chunks: PolicyChunk[]) {
  const llm: LlmProvider = { complete, stream: jest.fn() };
  const retrieve = jest.fn().mockReturnValue(chunks);
  const retrieval = { retrieve } as unknown as RetrievalService;
  return { service: new HelpService(llm, retrieval), retrieve };
}

describe('HelpService', () => {
  beforeEach(() => {
    // Fallbacks log a warning by design; keep test output clean.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when nothing in the policy matches', () => {
    it('does not call the LLM and answers "Not covered in the policy note"', async () => {
      const complete = jest.fn();
      const { service } = buildService(complete, []);

      const result = await service.getHelp({
        question: 'What is the capital of France?',
      });

      expect(complete).not.toHaveBeenCalled();
      expect(result.answer).toBe('Not covered in the policy note');
      expect(result.citations).toEqual([]);
      expect(HelpResponse.safeParse(result).success).toBe(true);
    });

    it('uses the same wording the help prompt tells the model to use', async () => {
      const { service } = buildService(jest.fn(), []);

      const result = await service.getHelp({ question: 'Anything unrelated?' });

      expect(result.answer).toBe(NOT_COVERED_ANSWER);
    });

    it('is not marked as an AI answer, since no model produced it', async () => {
      const { service } = buildService(jest.fn(), []);

      const result = await service.getHelp({ question: 'Anything unrelated?' });

      expect(result.source).toBe('fallback');
    });
  });

  describe('when chunks match', () => {
    it('retrieves with the question it was asked', async () => {
      const complete = jest.fn().mockResolvedValue('Because it is corrupt.');
      const { service, retrieve } = buildService(complete, [rejection]);

      await service.getHelp({ question: 'When do I reject something?' });

      expect(retrieve).toHaveBeenCalledWith('When do I reject something?');
    });

    it('builds the prompt from help.v1 and only the retrieved chunks', async () => {
      const complete = jest.fn().mockResolvedValue('Reject corrupt files.');
      const { service } = buildService(complete, [rejection, escalation]);

      await service.getHelp({ question: 'What are the rejection criteria?' });

      expect(complete).toHaveBeenCalledTimes(1);
      expect(complete).toHaveBeenCalledWith({
        system: helpPromptV1.system,
        messages: [
          {
            role: 'user',
            content: helpPromptV1.buildUserPrompt({
              question: 'What are the rejection criteria?',
              chunks: [rejection, escalation],
            }),
          },
        ],
      });

      const [request] = complete.mock.calls[0] as [
        { messages: { content: string }[] },
      ];
      const prompt = request.messages[0].content;
      expect(prompt).toContain(rejection.text);
      expect(prompt).toContain(escalation.text);
      expect(prompt).not.toContain(sla.text); // not retrieved, not sent
    });

    it('returns the model answer, with the chunk ids as citations', async () => {
      const complete = jest
        .fn()
        .mockResolvedValue('  Reject files that are corrupt.  ');
      const { service } = buildService(complete, [rejection, escalation]);

      const result = await service.getHelp({
        question: 'What are the rejection criteria?',
      });

      expect(result).toEqual({
        answer: 'Reject files that are corrupt.',
        citations: ['rejection-criteria', 'escalation'],
        source: 'ai',
      });
      expect(HelpResponse.safeParse(result).success).toBe(true);
    });

    it('drops the citations when the model itself says it is not covered', async () => {
      const complete = jest
        .fn()
        .mockResolvedValue('"Not covered in the policy note."');
      const { service } = buildService(complete, [rejection]);

      const result = await service.getHelp({ question: 'Who is the CEO?' });

      expect(result).toEqual({
        answer: NOT_COVERED_ANSWER,
        citations: [],
        source: 'ai',
      });
    });
  });

  describe('falls back to the top chunk verbatim (never throws)', () => {
    const expected = {
      answer: rejection.text,
      citations: ['rejection-criteria'],
      source: 'fallback',
    };

    it('on an LLM timeout', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmTimeoutError(8000));
      const { service } = buildService(complete, [rejection, escalation]);

      await expect(
        service.getHelp({ question: 'What are the rejection criteria?' }),
      ).resolves.toEqual(expected);
    });

    it('on an LLM failure', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmError('401'));
      const { service } = buildService(complete, [rejection, escalation]);

      await expect(
        service.getHelp({ question: 'What are the rejection criteria?' }),
      ).resolves.toEqual(expected);
    });

    it('on any unexpected error', async () => {
      const complete = jest.fn().mockRejectedValue(new TypeError('boom'));
      const { service } = buildService(complete, [rejection, escalation]);

      await expect(
        service.getHelp({ question: 'What are the rejection criteria?' }),
      ).resolves.toEqual(expected);
    });

    it('when the model returns an empty answer', async () => {
      const complete = jest.fn().mockResolvedValue('   ');
      const { service } = buildService(complete, [rejection, escalation]);

      await expect(
        service.getHelp({ question: 'What are the rejection criteria?' }),
      ).resolves.toEqual(expected);
    });
  });
});
