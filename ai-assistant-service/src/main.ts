import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.HOST ?? '127.0.0.1',
      port: Number(process.env.PORT ?? 4001),
    },
  });
  await app.listen();
}
await bootstrap();
