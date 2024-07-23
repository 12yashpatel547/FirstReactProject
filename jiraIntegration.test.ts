import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { DatabaseFeedbackStore } from '../database/feedbackStore';
import { JiraApiService } from '../api';
import { FeedbackModel } from '../model/feedback.model';

import { handleJiraIntegration } from './path-to-your-function-file';

jest.mock('../api', () => ({
  JiraApiService: jest.fn().mockImplementation(() => ({
    getJiraUsernameByEmail: jest.fn(),
    createJiraTicket: jest.fn(),
  })),
}));

describe('handleJiraIntegration', () => {
  let mockConfig: Config;
  let mockLogger: LoggerService;
  let mockFeedbackDB: DatabaseFeedbackStore;
  let mockJiraService: JiraApiService;
  let mockEntityRef: Entity;
  let reqData: FeedbackModel;
  let reporterEmail: string | undefined;
  let entityRoute: string;
  let feedbackType: string;
  let appTitle: string;

  beforeEach(() => {
    mockConfig = {
      getString: jest.fn(),
      getOptionalString: jest.fn(),
      getConfigArray: jest.fn(),
    } as unknown as Config;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    } as unknown as LoggerService;

    mockFeedbackDB = {
      updateFeedback: jest.fn(),
    } as unknown as DatabaseFeedbackStore;

    mockJiraService = new JiraApiService('host', 'token', mockLogger, 'hostType');
    (JiraApiService as jest.Mock).mockImplementation(() => mockJiraService);

    mockEntityRef = {
      metadata: {
        annotations: {
          'feedback/host': 'jira.example.com',
          'jira/project-key': 'PROJECT',
          'jira/component': 'Component',
        },
      },
    } as Entity;

    reqData = {
      summary: 'Test summary',
      description: 'Test description',
      tag: 'Test tag',
      feedbackType: 'FEEDBACK',
      feedbackId: '123',
    } as FeedbackModel;

    reporterEmail = 'reporter@example.com';
    entityRoute = 'http://example.com/entity';
    feedbackType = 'Feedback';
    appTitle = 'Test App';
  });

  it('should log an error if Jira integration is not found', async () => {
    (mockConfig.getConfigArray as jest.Mock).mockImplementation(() => {
      throw new Error('Config not found');
    });

    await handleJiraIntegration(reqData, mockEntityRef, mockConfig, mockLogger, mockFeedbackDB, reporterEmail, entityRoute, feedbackType, appTitle);

    expect(mockLogger.error).toHaveBeenCalledWith('Jira integration not found');
  });

  it('should update feedback with ticket URL if Jira ticket is created successfully', async () => {
    (mockConfig.getConfigArray as jest.Mock).mockReturnValue([
      {
        getString: jest.fn().mockReturnValue('jira.example.com'),
        getOptionalString: jest.fn(),
      },
    ]);

    mockJiraService.createJiraTicket = jest.fn().mockResolvedValue({ key: 'JIRA-123' });

    await handleJiraIntegration(reqData, mockEntityRef, mockConfig, mockLogger, mockFeedbackDB, reporterEmail, entityRoute, feedbackType, appTitle);

    expect(reqData.ticketUrl).toBe('jira.example.com/browse/JIRA-123');
    expect(mockFeedbackDB.updateFeedback).toHaveBeenCalledWith(reqData);
  });

  it('should not update feedback if Jira ticket creation fails', async () => {
    (mockConfig.getConfigArray as jest.Mock).mockReturnValue([
      {
        getString: jest.fn().mockReturnValue('jira.example.com'),
        getOptionalString: jest.fn(),
      },
    ]);

    mockJiraService.createJiraTicket = jest.fn().mockResolvedValue({ key: undefined });

    await handleJiraIntegration(reqData, mockEntityRef, mockConfig, mockLogger, mockFeedbackDB, reporterEmail, entityRoute, feedbackType, appTitle);

    expect(reqData.ticketUrl).toBeUndefined();
    expect(mockFeedbackDB.updateFeedback).not.toHaveBeenCalled();
  });

  it('should include reporter email in Jira description if Jira username is not found', async () => {
    (mockConfig.getConfigArray as jest.Mock).mockReturnValue([
      {
        getString: jest.fn().mockReturnValue('jira.example.com'),
        getOptionalString: jest.fn(),
      },
    ]);

    mockJiraService.getJiraUsernameByEmail = jest.fn().mockResolvedValue(undefined);
    mockJiraService.createJiraTicket = jest.fn().mockResolvedValue({ key: 'JIRA-123' });

    await handleJiraIntegration(reqData, mockEntityRef, mockConfig, mockLogger, mockFeedbackDB, reporterEmail, entityRoute, feedbackType, appTitle);

    expect(mockJiraService.createJiraTicket).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining(`Reported by: ${reporterEmail}`),
    }));
  });
});
