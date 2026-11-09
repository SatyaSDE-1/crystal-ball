import { Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { SummaryResponse } from '../contracts/schemas';
import { LlmError, LlmTimeoutError } from '../llm/llm.errors';
import { LlmProvider } from '../llm/llm.provider';
import { summaryPromptV1 } from '../prompts/summary.v1';
import { rankApprovals } from './fallback-ranking';
import { SummaryService } from './summary.service';

const approvalsService = new ApprovalsService();
const approvals = approvalsService.getApprovals();

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

function buildService(complete: jest.Mock) {
  const llm: LlmProvider = { complete, stream: jest.fn() };
  return new SummaryService(llm, approvalsService);
}

describe('SummaryService', () => {
  beforeEach(() => {
    // Fallbacks log a warning by design; keep test output clean.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a Zod-valid result with source "ai" when the LLM returns valid JSON', async () => {
    const complete = jest.fn().mockResolvedValue(JSON.stringify(aiSummary));

    const result = await buildService(complete).getSummary();

    expect(SummaryResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBe('ai');
    expect(result.items).toHaveLength(4);
    expect(result.headline).toBe(aiSummary.headline);
  });

  it('accepts JSON wrapped in code fences', async () => {
    const complete = jest
      .fn()
      .mockResolvedValue('```json\n' + JSON.stringify(aiSummary) + '\n```');

    const result = await buildService(complete).getSummary();

    expect(result.source).toBe('ai');
  });

  it('builds the request from the summary.v1 prompt and the approvals', async () => {
    const complete = jest.fn().mockResolvedValue(JSON.stringify(aiSummary));

    await buildService(complete).getSummary();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({
      system: summaryPromptV1.system,
      messages: [
        {
          role: 'user',
          content: summaryPromptV1.buildUserPrompt({ approvals }),
        },
      ],
    });
  });

  it('forces source "ai" even if the model claims otherwise', async () => {
    const complete = jest
      .fn()
      .mockResolvedValue(JSON.stringify({ ...aiSummary, source: 'fallback' }));

    const result = await buildService(complete).getSummary();

    expect(result.source).toBe('ai');
  });

  describe('falls back (never throws)', () => {
    const expectedFallback = rankApprovals(approvals);

    it('on malformed JSON', async () => {
      const complete = jest.fn().mockResolvedValue('{"headline": "cut off');

      await expect(buildService(complete).getSummary()).resolves.toEqual(
        expectedFallback,
      );
    });

    it('on prose instead of JSON', async () => {
      const complete = jest.fn().mockResolvedValue('Sure! Here is a summary.');

      const result = await buildService(complete).getSummary();

      expect(result.source).toBe('fallback');
    });

    it('on an invalid urgency', async () => {
      const bad = {
        ...aiSummary,
        items: aiSummary.items.map((i, n) =>
          n === 0 ? { ...i, urgency: 'critical' } : i,
        ),
      };
      const complete = jest.fn().mockResolvedValue(JSON.stringify(bad));

      const result = await buildService(complete).getSummary();

      expect(result.source).toBe('fallback');
      expect(result.items).toHaveLength(4);
    });

    it('when the model invents an approval id', async () => {
      const bad = {
        ...aiSummary,
        items: [
          ...aiSummary.items.slice(0, 3),
          { id: 'apr-99', urgency: 'low', reason: 'made up' },
        ],
      };
      const complete = jest.fn().mockResolvedValue(JSON.stringify(bad));

      const result = await buildService(complete).getSummary();

      expect(result.source).toBe('fallback');
    });

    it('when the model leaves an approval out', async () => {
      const bad = { ...aiSummary, items: aiSummary.items.slice(0, 3) };
      const complete = jest.fn().mockResolvedValue(JSON.stringify(bad));

      const result = await buildService(complete).getSummary();

      expect(result.source).toBe('fallback');
    });

    it('when the model repeats an approval', async () => {
      const bad = {
        ...aiSummary,
        items: [...aiSummary.items.slice(0, 3), aiSummary.items[0]],
      };
      const complete = jest.fn().mockResolvedValue(JSON.stringify(bad));

      const result = await buildService(complete).getSummary();

      expect(result.source).toBe('fallback');
    });

    it('on an LLM timeout', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmTimeoutError(8000));

      await expect(buildService(complete).getSummary()).resolves.toEqual(
        expectedFallback,
      );
    });

    it('on an LLM failure', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmError('401'));

      await expect(buildService(complete).getSummary()).resolves.toEqual(
        expectedFallback,
      );
    });

    it('on any unexpected error', async () => {
      const complete = jest.fn().mockRejectedValue(new TypeError('boom'));

      await expect(buildService(complete).getSummary()).resolves.toEqual(
        expectedFallback,
      );
    });
  });
});
