import { Module } from '@nestjs/common';
import { AiClientModule } from '../ai-client/ai-client.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AiClientModule, RateLimitModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
