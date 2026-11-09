import { Module } from '@nestjs/common';
import { AiClientModule } from '../ai-client/ai-client.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { GreetingController } from './greeting.controller';
import { GreetingService } from './greeting.service';

@Module({
  imports: [AiClientModule, RateLimitModule],
  controllers: [GreetingController],
  providers: [GreetingService],
})
export class GreetingModule {}
