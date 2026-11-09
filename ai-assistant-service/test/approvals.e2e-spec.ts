import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { AppModule } from './../src/app.module';
import { getMicroserviceOptions } from './../src/microservice.options';
import { ApprovalsPtrn } from './../src/messagepattern';

const FIELDS = [
  'id',
  'status',
  'submittedBy',
  'submittedDate',
  'title',
  'type',
];

const TEST_PORT = 4102;

describe('Approvals message pattern (e2e over TCP)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  beforeAll(async () => {
    process.env.TCP_HOST = '127.0.0.1';
    process.env.TCP_PORT = String(TEST_PORT);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.connectMicroservice(getMicroserviceOptions(app.get(ConfigService)));
    await app.startAllMicroservices();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: TEST_PORT },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  it('answers ApprovalsPtrn with the 4 fixtures', async () => {
    const approvals = await firstValueFrom(
      client.send<Record<string, string>[]>({ cmd: ApprovalsPtrn }, {}),
    );

    expect(approvals).toHaveLength(4);
    for (const approval of approvals) {
      expect(Object.keys(approval).sort()).toEqual(FIELDS);
      for (const value of Object.values(approval)) {
        expect(typeof value).toBe('string');
      }
    }
  });
});
