import {
  Controller,
  INestApplication,
  INestMicroservice,
} from '@nestjs/common';
import { MessagePattern, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { ApprovalsPtrn } from './../src/messagepattern';

const FIELDS = [
  'id',
  'status',
  'submittedBy',
  'submittedDate',
  'title',
  'type',
];

const STUB_PORT = 4103;

const STUB_APPROVALS = [
  ['apr-1', 'Site Patrol Onboarding & Checklists', 'Folder', 'Sam HelpAdmin'],
  ['apr-2', 'Level 2 Drone Patrol Video Demo', 'Video', 'Alex HelpAdmin'],
  ['apr-3', 'Safety Equipment & Sensor Specs', 'PDF', 'Sam HelpAdmin'],
  [
    'apr-4',
    '360° Spatial Zone Layout & Camera Map',
    'Image',
    'Elena HelpAdmin',
  ],
].map(([id, title, type, submittedBy]) => ({
  id,
  title,
  type,
  submittedBy,
  status: 'Pending Review',
  submittedDate: 'Sep 18',
}));

/** Stands in for ai-assistant-service, over a real TCP socket. */
@Controller()
class StubAiAssistantController {
  @MessagePattern({ cmd: ApprovalsPtrn })
  getApprovals() {
    return STUB_APPROVALS;
  }
}

describe('GET /api/approvals (e2e)', () => {
  let app: INestApplication<App>;
  let stub: INestMicroservice;

  beforeAll(async () => {
    const stubModule = await Test.createTestingModule({
      controllers: [StubAiAssistantController],
    }).compile();
    stub = stubModule.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: STUB_PORT },
    });
    await stub.listen();

    process.env.AI_ASSISTANT_HOST = '127.0.0.1';
    process.env.AI_ASSISTANT_PORT = String(STUB_PORT);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stub.close();
  });

  it('returns 200 with the 4 approvals from the AI service', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/approvals')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveLength(4);
  });

  it('returns every field on every item', async () => {
    const res = await request(app.getHttpServer()).get('/api/approvals');

    for (const item of res.body as Record<string, unknown>[]) {
      expect(Object.keys(item).sort()).toEqual(FIELDS);
      for (const value of Object.values(item)) {
        expect(typeof value).toBe('string');
      }
    }
  });
});
