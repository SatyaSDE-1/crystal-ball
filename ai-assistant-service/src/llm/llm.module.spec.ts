import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LLM_PROVIDER, type LlmProvider } from './llm.provider';
import { LlmModule } from './llm.module';
import { LlmService } from './llm.service';

describe('LlmModule', () => {
  it('provides LlmService behind the LLM_PROVIDER token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), LlmModule],
    }).compile();

    const provider = moduleRef.get<LlmProvider>(LLM_PROVIDER);

    expect(provider).toBeInstanceOf(LlmService);
  });

  it('is global: other modules can inject the provider without importing LlmModule', async () => {
    @Injectable()
    class Consumer {
      constructor(@Inject(LLM_PROVIDER) readonly llm: LlmProvider) {}
    }

    @Module({ providers: [Consumer] })
    class FeatureModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LlmModule,
        FeatureModule,
      ],
    }).compile();

    expect(moduleRef.get(Consumer).llm).toBeInstanceOf(LlmService);
  });
});
