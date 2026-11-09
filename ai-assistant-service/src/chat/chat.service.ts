import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApprovalsService } from '../approvals/approvals.service';
import { ChatMessage, ChatRequest } from '../contracts/schemas';
import {
  LLM_PROVIDER,
  type LlmProvider,
  type LlmRequest,
} from '../llm/llm.provider';
import { chatTalkPromptV1 } from '../prompts/chat-talk.v1';
import { chatTeachPromptV1 } from '../prompts/chat-teach.v1';
import { ChatEvent, FRIENDLY_ERROR_MESSAGE } from './chat.events';


const MAX_HISTORY_MESSAGES = 20;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly approvalsService: ApprovalsService,
  ) {}


  async *chat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    try {
      let tokens = 0;
      for await (const text of this.llm.stream(this.buildRequest(request))) {
        if (!text) {
          continue;
        }
        tokens++;
        yield { type: 'token', text };
      }

      if (tokens === 0) {
        throw new Error('LLM returned no tokens');
      }
      yield { type: 'done' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Chat stream failed: ${reason}`);
      yield { type: 'error', message: FRIENDLY_ERROR_MESSAGE };
    }
  }


  private buildRequest(request: ChatRequest): LlmRequest {
    const prompt =
      request.mode === 'teach' ? chatTeachPromptV1 : chatTalkPromptV1;

    const recent = recentMessages(request.messages);
    const current = recent.at(-1);
    if (current?.role !== 'user') {
      throw new Error('The last message must be from the user');
    }

    return {
      system: prompt.system,
      messages: [
        ...recent.slice(0, -1),
        {
          role: 'user',
          content: prompt.buildUserPrompt({
            approvals: this.approvalsService.getApprovals(),
            question: current.content,
          }),
        },
      ],
    };
  }
}

function recentMessages(messages: ChatMessage[]): ChatMessage[] {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES);
  while (recent[0]?.role === 'assistant') {
    recent.shift();
  }
  return recent;
}
