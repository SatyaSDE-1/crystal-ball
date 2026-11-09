import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { Approval, LocaleRequest, SummaryResponse } from '../contracts/schemas';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { summaryPromptV2 } from '../prompts/summary.v2';
import { rankApprovals } from './fallback-ranking';
import { parseSummary } from './summary.parser';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly approvalsService: ApprovalsService,
  ) {}


  async getSummary({ locale }: LocaleRequest = {}): Promise<SummaryResponse> {
    const approvals = this.approvalsService.getApprovals();

    try {
      const raw = await this.llm.complete({
        system: summaryPromptV2.system,
        messages: [
          {
            role: 'user',
            content: summaryPromptV2.buildUserPrompt({ approvals, locale }),
          },
        ],
      });

      const parsed = parseSummary(raw);
      if (!parsed) {
        return this.fallback(
          approvals,
          'LLM output was not valid summary JSON',
        );
      }
      if (!coversExactly(parsed, approvals)) {
        return this.fallback(
          approvals,
          'LLM output did not list every approval exactly once',
        );
      }

  
      return { ...parsed, source: 'ai' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.fallback(approvals, reason);
    }
  }

  private fallback(approvals: Approval[], reason: string): SummaryResponse {
    this.logger.warn(`Summary fell back to deterministic ranking: ${reason}`);
    return rankApprovals(approvals);
  }
}


function coversExactly(
  summary: SummaryResponse,
  approvals: Approval[],
): boolean {
  const returned = summary.items.map((item) => item.id).sort();
  const expected = approvals.map((approval) => approval.id).sort();

  return (
    returned.length === expected.length &&
    returned.every((id, index) => id === expected[index])
  );
}
