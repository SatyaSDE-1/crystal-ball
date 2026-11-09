import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { GreetingResponse } from '../contracts/schemas';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { greetingPromptV1 } from '../prompts/greeting.v1';
import {
  cleanGreeting,
  countPending,
  fallbackGreeting,
  mentionsCount,
} from './greeting.helpers';

/** High on purpose: each call should word the greeting differently. */
const GREETING_TEMPERATURE = 1;
/** A greeting is one or two sentences; anything longer is the model rambling. */
const MAX_GREETING_LENGTH = 280;

@Injectable()
export class GreetingService {
  private readonly logger = new Logger(GreetingService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly approvalsService: ApprovalsService,
  ) {}

  /**
   * Regenerated on every call (never cached or replayed).
   * Never throws: any failure degrades to "You have N approvals pending."
   */
  async getGreeting(): Promise<GreetingResponse> {
    const pendingCount = countPending(this.approvalsService.getApprovals());

    try {
      const raw = await this.llm.complete({
        system: greetingPromptV1.system,
        messages: [
          {
            role: 'user',
            content: greetingPromptV1.buildUserPrompt({ pendingCount }),
          },
        ],
        temperature: GREETING_TEMPERATURE,
      });

      const text = cleanGreeting(raw);
      if (!text) {
        return this.fallback(pendingCount, 'LLM returned an empty greeting');
      }
      if (text.length > MAX_GREETING_LENGTH) {
        return this.fallback(pendingCount, 'LLM greeting was too long');
      }
      if (!mentionsCount(text, pendingCount)) {
        return this.fallback(
          pendingCount,
          'LLM greeting did not mention the pending count',
        );
      }

      return { text, source: 'ai' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.fallback(pendingCount, reason);
    }
  }

  private fallback(pendingCount: number, reason: string): GreetingResponse {
    this.logger.warn(`Greeting fell back to fixed text: ${reason}`);
    return { text: fallbackGreeting(pendingCount), source: 'fallback' };
  }
}
