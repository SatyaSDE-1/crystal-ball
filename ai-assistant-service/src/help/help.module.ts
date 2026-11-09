import { Module } from '@nestjs/common';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { HelpController } from './help.controller';
import { HelpService } from './help.service';

@Module({
  imports: [RetrievalModule],
  controllers: [HelpController],
  providers: [HelpService],
})
export class HelpModule {}
