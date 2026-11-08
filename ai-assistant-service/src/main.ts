import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getMicroserviceOptions } from './microservice.options';

async function bootstrap() {
  // Hybrid app: the HTTP side is never listened on; it only gives us
  // ConfigService before we choose the TCP options.
  const app = await NestFactory.create(AppModule);
  const options = getMicroserviceOptions(app.get(ConfigService));

  app.connectMicroservice(options);
  await app.startAllMicroservices();

  Logger.log(
    `AI assistant service listening on TCP ${JSON.stringify(options.options)}`,
  );
}
void bootstrap();
