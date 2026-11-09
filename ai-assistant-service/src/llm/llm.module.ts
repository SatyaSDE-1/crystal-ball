import { Global, Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm.provider';
import { LlmService } from './llm.service';

/**
 * Global, so feature modules inject LLM_PROVIDER without importing this.
 * To switch provider, change `useClass` here.
 */
@Global()
@Module({
  providers: [{ provide: LLM_PROVIDER, useClass: LlmService }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
