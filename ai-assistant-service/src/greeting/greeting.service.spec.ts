import { Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { Approval, GreetingResponse } from '../contracts/schemas';
import { LlmError, LlmTimeoutError } from '../llm/llm.errors';
import { LlmProvider } from '../llm/llm.provider';
import { greetingPromptV1 } from '../prompts/greeting.v1';
import { GreetingService } from './greeting.service';

const realApprovals = new ApprovalsService();

function buildService(
  complete: jest.Mock,
  approvalsService: Pick<ApprovalsService, 'getApprovals'> = realApprovals,
) {
  const llm: LlmProvider = { complete, stream: jest.fn() };
  return new GreetingService(llm, approvalsService as ApprovalsService);
}

function queueOf(statuses: string[]): Pick<ApprovalsService, 'getApprovals'> {
  const approvals: Approval[] = statuses.map((status, index) => ({
    id: `apr-${index + 1}`,
    title: `Item ${index + 1}`,
    type: 'PDF',
    submittedBy: 'Sam HelpAdmin',
    status,
    submittedDate: 'Sep 18',
  }));
  return { getApprovals: () => approvals };
}

describe('GreetingService', () => {
  beforeEach(() => {
    // Fallbacks log a warning by design; keep test output clean.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the AI greeting (source "ai") when it mentions the pending count', async () => {
    const complete = jest
      .fn()
      .mockResolvedValue('Good morning! You have 4 approvals waiting.');

    const result = await buildService(complete).getGreeting();

    expect(result).toEqual({
      text: 'Good morning! You have 4 approvals waiting.',
      source: 'ai',
    });
    expect(GreetingResponse.safeParse(result).success).toBe(true);
  });

  it('builds the request from greeting.v1 with the real pending count', async () => {
    const complete = jest.fn().mockResolvedValue('Hi! 4 approvals await.');

    await buildService(complete).getGreeting();

    expect(complete).toHaveBeenCalledWith({
      system: greetingPromptV1.system,
      messages: [
        {
          role: 'user',
          content: greetingPromptV1.buildUserPrompt({ pendingCount: 4 }),
        },
      ],
      temperature: expect.any(Number) as number,
    });
  });

  it('asks for varied wording with a high temperature', async () => {
    const complete = jest.fn().mockResolvedValue('Hi! 4 approvals await.');

    await buildService(complete).getGreeting();

    const [request] = complete.mock.calls[0] as [{ temperature: number }];
    expect(request.temperature).toBeGreaterThanOrEqual(0.8);
  });

  it('regenerates each time instead of replaying a fixed string', async () => {
    const complete = jest
      .fn()
      .mockResolvedValueOnce('Hello! 4 approvals are pending.')
      .mockResolvedValueOnce('Welcome back, 4 items need you.');
    const service = buildService(complete);

    const first = await service.getGreeting();
    const second = await service.getGreeting();

    expect(first.text).not.toBe(second.text);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('accepts the count written as a word', async () => {
    const complete = jest
      .fn()
      .mockResolvedValue('Welcome! Four approvals need a look.');

    const result = await buildService(complete).getGreeting();

    expect(result.source).toBe('ai');
  });

  it('strips quotes the model wraps around the greeting', async () => {
    const complete = jest.fn().mockResolvedValue('"Hi! 4 approvals await."');

    const result = await buildService(complete).getGreeting();

    expect(result.text).toBe('Hi! 4 approvals await.');
  });

  it('counts only pending items', async () => {
    const complete = jest.fn().mockResolvedValue('Hi, you have 2 pending.');
    const queue = queueOf(['Pending Review', 'Approved', 'Pending Review']);

    const result = await buildService(complete, queue).getGreeting();

    expect(result.source).toBe('ai');
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: greetingPromptV1.buildUserPrompt({ pendingCount: 2 }),
          },
        ],
      }),
    );
  });

  describe('falls back to "You have N approvals pending." (never throws)', () => {
    const expected = {
      text: 'You have 4 approvals pending.',
      source: 'fallback',
    };

    it('on an LLM timeout', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmTimeoutError(8000));

      await expect(buildService(complete).getGreeting()).resolves.toEqual(
        expected,
      );
    });

    it('on an LLM failure', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmError('401'));

      await expect(buildService(complete).getGreeting()).resolves.toEqual(
        expected,
      );
    });

    it('on any unexpected error', async () => {
      const complete = jest.fn().mockRejectedValue(new TypeError('boom'));

      await expect(buildService(complete).getGreeting()).resolves.toEqual(
        expected,
      );
    });

    it('when the model leaves the pending count out', async () => {
      const complete = jest.fn().mockResolvedValue('Welcome back, operator!');

      await expect(buildService(complete).getGreeting()).resolves.toEqual(
        expected,
      );
    });

    it('when the model returns an empty greeting', async () => {
      const complete = jest.fn().mockResolvedValue('   ');

      await expect(buildService(complete).getGreeting()).resolves.toEqual(
        expected,
      );
    });

    it('when the model rambles past the length limit', async () => {
      const complete = jest
        .fn()
        .mockResolvedValue(`You have 4 approvals. ${'Blah '.repeat(80)}`);

      await expect(buildService(complete).getGreeting()).resolves.toEqual(
        expected,
      );
    });

    it('with the right wording for a single pending item', async () => {
      const complete = jest.fn().mockRejectedValue(new LlmError('down'));
      const queue = queueOf(['Pending Review']);

      await expect(
        buildService(complete, queue).getGreeting(),
      ).resolves.toEqual({
        text: 'You have 1 approval pending.',
        source: 'fallback',
      });
    });
  });
});
