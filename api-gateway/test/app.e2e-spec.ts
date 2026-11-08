import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('Gateway bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api returns a 404 JSON body (server is up, prefix is "api")', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(404);

    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ statusCode: 404 });
  });

  it('allows the configured CORS origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });
});
