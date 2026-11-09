import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [SummaryController],
  providers: [SummaryService],
})
export class SummaryModule {}
