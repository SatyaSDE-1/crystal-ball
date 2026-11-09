import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  // Exported: summary, greeting and chat build their prompts from this list.
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
