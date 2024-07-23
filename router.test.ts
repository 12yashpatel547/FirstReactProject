import express, { Request, Response } from 'express';
import { createRouter, RouterOptions } from './router';
import { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { PluginEndpointDiscovery } from '@backstage/backend-common';
import { CatalogClient } from '@backstage/catalog-client';
import { DatabaseFeedbackStore } from '../database/feedbackStore';
import { NodeMailer } from './emails';
import { JiraApiService } from '../api';
import { Entity, UserEntityV1alpha1 } from '@backstage/catalog-model';
import request from 'supertest';

// backstage for yash patel idp
jest.mock('@backstage/backend-common', () => ({
  DatabaseManager: {
    fromConfig: jest.fn().mockReturnValue({
      forPlugin: jest.fn().mockReturnValue({
        getClient: jest.fn(),
      }),
    }),
  },
  errorHandler: jest.fn().mockReturnValue((req, res, next) => next()),
}));

jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntityByRef: jest.fn(),
  })),
}));

jest.mock('../database/feedbackStore', () => ({
  DatabaseFeedbackStore: {
    create: jest.fn().mockReturnValue({
      storeFeedbackGetUuid: jest.fn(),
      checkFeedbackId: jest.fn(),
      getFeedbackByUuid: jest.fn(),
      updateFeedback: jest.fn(),
      deleteFeedbackById: jest.fn(),
      getAllFeedbacks: jest.fn(),
    }),
  },
}));

jest.mock('./emails', () => ({
  NodeMailer: jest.fn().mockImplementation(() => ({
    sendMail: jest.fn(),
  })),
}));

jest.mock('../api', () => ({
  JiraApiService: jest.fn().mockImplementation(() => ({
    getJiraUsernameByEmail: jest.fn(),
    createJiraTicket: jest.fn(),
    getTicketDetails: jest.fn(),
  })),
}));

describe('router', () => {
  let app: express.Express;
  let logger: LoggerService;
  let config: Config;
  let discovery: PluginEndpointDiscovery;
  let auth: AuthService;

  beforeEach(async () => {
    logger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as LoggerService;

    config = {
      getString: jest.fn().mockReturnValue('mockString'),
      getOptionalString: jest.fn().mockReturnValue('mockString'),
      getConfigArray: jest.fn().mockReturnValue([{ getString: jest.fn().mockReturnValue('mockString') }]),
    } as unknown as Config;

    discovery = {
      getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7000'),
      getExternalBaseUrl: jest.fn().mockResolvedValue('http://localhost:7000'),
    };

    auth = {
      getPluginRequestToken: jest.fn().mockResolvedValue({ token: 'mockToken' }),
      getOwnServiceCredentials: jest.fn().mockResolvedValue('mockServiceCredentials'),
    };

    const routerOptions: RouterOptions = { logger, config, discovery, auth };
    const router = await createRouter(routerOptions);
    
    app = express();
    app.use(router);
  });

  describe('POST /', () => {
    it('should return 500 if summary is empty', async () => {
      const response = await request(app).post('/').send({
        summary: '',
        description: 'Description',
        createdBy: 'user/123',
        feedbackType: 'FEEDBACK',
        projectId: 'component/123',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Summary field empty' });
    });

    // Add more tests for different scenarios
  });

  describe('GET /', () => {
    it('should fetch all feedbacks successfully', async () => {
      const feedbackDB = DatabaseFeedbackStore.create({ database: null, skipMigrations: false, logger });
      feedbackDB.getAllFeedbacks.mockResolvedValue({ items: [], totalCount: 0 });

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], totalCount: 0, currentPage: 1, pageSize: 10 });
    });

    // Add more tests for different scenarios
  });

  describe('GET /:id', () => {
    it('should return 404 if feedback not found', async () => {
      const feedbackDB = DatabaseFeedbackStore.create({ database: null, skipMigrations: false, logger });
      feedbackDB.checkFeedbackId.mockResolvedValue(false);

      const response = await request(app).get('/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No feedback found for id nonexistent-id' });
    });

    // Add more tests for different scenarios
  });

  describe('PATCH /:id', () => {
    it('should return 404 if feedback not found', async () => {
      const feedbackDB = DatabaseFeedbackStore.create({ database: null, skipMigrations: false, logger });
      feedbackDB.checkFeedbackId.mockResolvedValue(false);

      const response = await request(app).patch('/nonexistent-id').send({ summary: 'Updated summary' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No feedback found for id nonexistent-id' });
    });

    // Add more tests for different scenarios
  });

  describe('DELETE /:id', () => {
    it('should return 404 if feedback not found', async () => {
      const feedbackDB = DatabaseFeedbackStore.create({ database: null, skipMigrations: false, logger });
      feedbackDB.checkFeedbackId.mockResolvedValue(false);

      const response = await request(app).delete('/nonexistent-id');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'No feedback found for id nonexistent-id' });
    });

    // Add more tests for different scenarios
  });
});
