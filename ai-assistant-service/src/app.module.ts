import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalsModule } from './approvals/approvals.module';
import { GreetingModule } from './greeting/greeting.module';
import { HelpModule } from './help/help.module';
import { LlmModule } from './llm/llm.module';
import { SummaryModule } from './summary/summary.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LlmModule,
    ApprovalsModule,
    SummaryModule,
    GreetingModule,
    HelpModule,
  ],
})
export class AppModule {}
