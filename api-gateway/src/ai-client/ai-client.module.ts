import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AI_ASSISTANT_CLIENT } from './ai-client.constants';

/** One shared TCP connection to ai-assistant-service, configured via ConfigService. */
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: AI_ASSISTANT_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get<string>('AI_ASSISTANT_HOST', '127.0.0.1'),
            port: Number(config.get('AI_ASSISTANT_PORT', 4001)),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class AiClientModule {}
