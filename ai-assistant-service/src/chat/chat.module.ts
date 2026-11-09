import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
