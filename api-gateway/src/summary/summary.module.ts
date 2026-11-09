import { Module } from '@nestjs/common';
import { AiClientModule } from '../ai-client/ai-client.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [AiClientModule, RateLimitModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
