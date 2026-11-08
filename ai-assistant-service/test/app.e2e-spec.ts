import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Socket } from 'node:net';
import { AppModule } from './../src/app.module';
import { getMicroserviceOptions } from './../src/microservice.options';

const TEST_PORT = 4101;

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

describe('AI assistant microservice bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.TCP_HOST = '127.0.0.1';
    process.env.TCP_PORT = String(TEST_PORT);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.connectMicroservice(getMicroserviceOptions(app.get(ConfigService)));
    await app.startAllMicroservices();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts TCP connections on the configured port', async () => {
    await expect(canConnect(TEST_PORT)).resolves.toBe(true);
  });
});
