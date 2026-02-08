import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('API Endpoints (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('/health (GET)', () => {
        it('should return health status', () => {
            return request(app.getHttpServer())
                .get('/health')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('status');
                    expect(res.body).toHaveProperty('timestamp');
                    expect(res.body).toHaveProperty('services');
                    expect(res.body.services).toHaveProperty('database');
                    expect(res.body.services).toHaveProperty('redis');
                });
        });
    });

    describe('/commissions (GET)', () => {
        it('should return list of commissions', () => {
            return request(app.getHttpServer())
                .get('/commissions')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('commissions');
                    expect(Array.isArray(res.body.commissions)).toBe(true);
                });
        });
    });

    describe('/dashboard/summary (GET)', () => {
        it('should return dashboard summary', () => {
            return request(app.getHttpServer())
                .get('/dashboard/summary')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('hits_keyword');
                    expect(res.body).toHaveProperty('hits_topics');
                    expect(res.body).toHaveProperty('hits_commissions');
                    expect(res.body).toHaveProperty('updates_watchlist');
                });
        });
    });

    describe('/config/watchlist/by-number (POST)', () => {
        it('should add measure to watchlist by number', () => {
            return request(app.getHttpServer())
                .post('/config/watchlist/by-number')
                .send({ number: 'TEST-001' })
                .expect(201)
                .expect((res) => {
                    expect(res.body).toHaveProperty('success');
                    expect(res.body.success).toBe(true);
                });
        });

        it('should handle missing number parameter', () => {
            return request(app.getHttpServer())
                .post('/config/watchlist/by-number')
                .send({})
                .expect(400);
        });
    });
});
