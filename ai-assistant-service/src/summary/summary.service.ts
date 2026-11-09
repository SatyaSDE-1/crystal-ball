import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { Approval, SummaryResponse } from '../contracts/schemas';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { summaryPromptV1 } from '../prompts/summary.v1';
import { rankApprovals } from './fallback-ranking';
import { parseSummary } from './summary.parser';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly approvalsService: ApprovalsService,
  ) {}

  /** Never throws: any failure degrades to the deterministic ranking. */
  async getSummary(): Promise<SummaryResponse> {
    const approvals = this.approvalsService.getApprovals();

    try {
      const raw = await this.llm.complete({
        system: summaryPromptV1.system,
        messages: [
          {
            role: 'user',
            content: summaryPromptV1.buildUserPrompt({ approvals }),
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

      // The server decides the source, never the model.
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

/** The model must rank every approval exactly once, using real ids only. */
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
