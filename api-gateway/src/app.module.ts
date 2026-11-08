import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AssistantModule } from './assistant/assistant.module.js';

@Module({
  imports: [AssistantModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
