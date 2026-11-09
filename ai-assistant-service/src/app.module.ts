import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApprovalsModule } from './approvals/approvals.module';
import { ChatModule } from './chat/chat.module';
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
    ChatModule,
  ],
})
export class AppModule {}
