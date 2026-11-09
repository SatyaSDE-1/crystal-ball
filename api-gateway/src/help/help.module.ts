import { Module } from '@nestjs/common';
import { AiClientModule } from '../ai-client/ai-client.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

@Module({
  imports: [AiClientModule, RateLimitModule],
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
