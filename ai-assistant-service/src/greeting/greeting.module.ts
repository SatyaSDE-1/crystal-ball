import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { GreetingController } from './greeting.controller';
import { GreetingService } from './greeting.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [GreetingController],
  providers: [GreetingService],
})
export class GreetingModule {}
