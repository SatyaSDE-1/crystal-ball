import { Module } from '@nestjs/common';
import { AiClientModule } from '../ai-client/ai-client.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [AiClientModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
