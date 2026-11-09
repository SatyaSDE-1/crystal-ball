import { Inject, Injectable, Logger } from '@nestjs/common';
import { HelpRequest, HelpResponse } from '../contracts/schemas';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm.provider';
import { helpPromptV1, NOT_COVERED_ANSWER } from '../prompts/help.v1';
import { PolicyChunk } from '../prompts/types';
import { RetrievalService } from '../retrieval/retrieval.service';

/** Compares answers ignoring case, quotes and punctuation. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

@Injectable()
export class HelpService {
  private readonly logger = new Logger(HelpService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly retrieval: RetrievalService,
  ) {}

  /**
   * Retrieve first, then answer only from what was retrieved.
   * Never throws: any LLM failure degrades to the top chunk, verbatim.
   *
   * `source` is "ai" only when the model produced the answer. A question
   * with no matching chunk never reaches the model, so that reply is
   * deterministic and is marked "fallback".
   */
  async getHelp({ question }: HelpRequest): Promise<HelpResponse> {
    const chunks = this.retrieval.retrieve(question);

    if (chunks.length === 0) {
      return { answer: NOT_COVERED_ANSWER, citations: [], source: 'fallback' };
    }

    try {
      const raw = await this.llm.complete({
        system: helpPromptV1.system,
        messages: [
          {
            role: 'user',
            content: helpPromptV1.buildUserPrompt({ question, chunks }),
          },
        ],
      });

      const answer = raw.trim();
      if (!answer) {
        return this.fallback(chunks, 'LLM returned an empty answer');
      }

      // The model decided the context does not answer it: cite nothing.
      if (normalise(answer) === normalise(NOT_COVERED_ANSWER)) {
        return { answer: NOT_COVERED_ANSWER, citations: [], source: 'ai' };
      }

      return {
        answer,
        citations: chunks.map((chunk) => chunk.id),
        source: 'ai',
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.fallback(chunks, reason);
    }
  }

  private fallback(chunks: PolicyChunk[], reason: string): HelpResponse {
    this.logger.warn(`Help fell back to the top policy chunk: ${reason}`);
    const [top] = chunks;
    return { answer: top.text, citations: [top.id], source: 'fallback' };
  }
}
