import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CohereClientV2 } from 'cohere-ai';
import { LlmError, LlmTimeoutError } from './llm.errors';
import { LlmProvider, LlmRequest } from './llm.provider';

const DEFAULT_MODEL = 'command-a-03-2025';
const DEFAULT_TIMEOUT_MS = 8000;


@Injectable()
export class LlmService implements LlmProvider {
  private client?: CohereClientV2;

  constructor(private readonly config: ConfigService) {}

  async complete(request: LlmRequest): Promise<string> {
    this.assertAvailable();
    const client = this.getClient();
    const timeoutMs = this.timeoutMs();
    const controller = new AbortController();

    const response = await this.withTimeout(
      client.chat(this.toChatRequest(request), {
        abortSignal: controller.signal,
        maxRetries: 0,
      }),
      timeoutMs,
      controller,
    );

    const text = (response.message?.content ?? [])
      .map((item) => (item.type === 'text' ? item.text : ''))
      .join('');

    if (!text.trim()) {
      throw new LlmError('LLM returned an empty response');
    }
    return text;
  }

  async *stream(request: LlmRequest): AsyncGenerator<string> {
    this.assertAvailable();
    const client = this.getClient();
    const timeoutMs = this.timeoutMs();
    const controller = new AbortController();

    const events = await this.withTimeout(
      client.chatStream(this.toChatRequest(request), {
        abortSignal: controller.signal,
        maxRetries: 0,
      }),
      timeoutMs,
      controller,
    );

    const iterator = events[Symbol.asyncIterator]();
    try {
      while (true) {
        // The timeout applies to each wait for the next event, so a stream
        // that stalls mid-answer is cut off too.
        const next = await this.withTimeout(
          iterator.next(),
          timeoutMs,
          controller,
        );
        if (next.done) {
          return;
        }
        const event = next.value;
        if (event.type === 'content-delta') {
          const text = event.delta?.message?.content?.text;
          if (text) {
            yield text;
          }
        }
      }
    } finally {
      controller.abort();
    }
  }

  private toChatRequest(request: LlmRequest) {
    return {
      model: this.config.get<string>('COHERE_MODEL', DEFAULT_MODEL),
      messages: [
        { role: 'system' as const, content: request.system },
        ...request.messages,
      ],
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
    };
  }

  private timeoutMs(): number {
    const value = Number(this.config.get('LLM_TIMEOUT_MS', DEFAULT_TIMEOUT_MS));
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
  }

  /** Demo switch: every LLM call fails, to prove the fallbacks work. */
  private assertAvailable(): void {
    if (this.config.get<string>('FORCE_LLM_FAILURE') === 'true') {
      throw new LlmError('LLM failure forced by FORCE_LLM_FAILURE');
    }
  }

  /** Created lazily so the app boots (and falls back) without a key. */
  private getClient(): CohereClientV2 {
    if (!this.client) {
      const token = this.config.get<string>('COHERE_API_KEY');
      if (!token) {
        throw new LlmError('COHERE_API_KEY is not set');
      }
      this.client = new CohereClientV2({ token });
    }
    return this.client;
  }

  /**
   * Races a provider call against the timeout. On timeout the request is
   * aborted and an LlmTimeoutError is thrown. Any other failure becomes an
   * LlmError so callers only ever handle one error family.
   */
  private async withTimeout<T>(
    call: PromiseLike<T>,
    timeoutMs: number,
    controller: AbortController,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new LlmTimeoutError(timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([Promise.resolve(call), timeout]);
    } catch (error) {
      if (error instanceof LlmError) {
        throw error;
      }
      throw new LlmError(
        error instanceof Error ? error.message : 'LLM request failed',
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
