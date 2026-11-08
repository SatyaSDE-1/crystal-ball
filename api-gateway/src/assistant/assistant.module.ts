import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AI_ASSISTANT_CLIENT } from './assistant.constants.js';
import { AssistantService } from './assistant.service.js';
import { AssistantController } from './assistant.controller.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: AI_ASSISTANT_CLIENT,
        transport: Transport.TCP,
        options: {
          host: process.env.AI_ASSISTANT_HOST ?? '127.0.0.1',
          port: Number(process.env.AI_ASSISTANT_PORT ?? 4001),
        },
      },
    ]),
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
