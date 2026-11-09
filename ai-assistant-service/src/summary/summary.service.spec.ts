import { Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { SummaryResponse } from '../contracts/schemas';
import { LlmError, LlmTimeoutError } from '../llm/llm.errors';
import { LlmProvider } from '../llm/llm.provider';
import { summaryPromptV2 } from '../prompts/summary.v2';
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

  it('builds the request from the summary.v2 prompt and the approvals', async () => {
    const complete = jest.fn().mockResolvedValue(JSON.stringify(aiSummary));

    await buildService(complete).getSummary();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({
      system: summaryPromptV2.system,
      messages: [
        {
          role: 'user',
          content: summaryPromptV2.buildUserPrompt({ approvals }),
        },
      ],
    });
  });

  describe("the operator's language", () => {
    const spanish = {
      ...aiSummary,
      headline:
        'Cuatro aprobaciones pendientes; las especificaciones de seguridad primero.',
      items: aiSummary.items.map((item) => ({
        ...item,
        reason: 'Motivo en español.',
      })),
    };

    it('asks the model to write in the operator language', async () => {
      const complete = jest.fn().mockResolvedValue(JSON.stringify(spanish));

      await buildService(complete).getSummary({ locale: 'es' });

      expect(complete).toHaveBeenCalledWith({
        system: summaryPromptV2.system,
        messages: [
          {
            role: 'user',
            content: summaryPromptV2.buildUserPrompt({
              approvals,
              locale: 'es',
            }),
          },
        ],
      });
      const [request] = complete.mock.calls[0] as [
        { messages: { content: string }[] },
      ];
      expect(request.messages[0].content).toContain('Spanish');
    });

    it('accepts a summary written in another language, as long as the structure is right', async () => {
      const complete = jest.fn().mockResolvedValue(JSON.stringify(spanish));

      const result = await buildService(complete).getSummary({ locale: 'es' });

      expect(result.source).toBe('ai');
      expect(result.headline).toBe(spanish.headline);
      expect(SummaryResponse.safeParse(result).success).toBe(true);
    });

    it('still rejects a translated urgency, because the enum stays English', async () => {
      const translated = {
        ...spanish,
        items: spanish.items.map((item) => ({ ...item, urgency: 'alta' })),
      };
      const complete = jest.fn().mockResolvedValue(JSON.stringify(translated));

      const result = await buildService(complete).getSummary({ locale: 'es' });

      expect(result.source).toBe('fallback');
    });

    it('sends no language instruction when there is no locale', async () => {
      const complete = jest.fn().mockResolvedValue(JSON.stringify(aiSummary));

      await buildService(complete).getSummary();

      const [request] = complete.mock.calls[0] as [
        { messages: { content: string }[] },
      ];
      expect(request.messages[0].content).not.toMatch(/language/i);
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
