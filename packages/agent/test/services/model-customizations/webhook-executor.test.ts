import { ActionContext } from '@forestadmin/datasource-customizer';
import {
  ActionScope,
  ActionType,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';
import superagent from 'superagent';

import createWebhookExecutor from '../../../src/services/model-customizations/webhook-executor';

jest.mock('superagent', () => ({
  post: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
}));

const superagentMock = superagent as unknown as {
  post: jest.Mock;
  send: jest.Mock;
};

describe('Services > ModelCustomizations > WebhookExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWebhookExecutor', () => {
    describe('when the action scope is global', () => {
      it('should send a request with the action name and the scope', async () => {
        const action = {
          id: 42,
          name: 'myAction',
          modelName: 'myModel',
          type: ModelCustomizationType.action,
          configuration: {
            type: ActionType.webhook,
            scope: ActionScope.global,
            url: 'https://my-url.com',
            integration: 'myIntegration',
          },
        };

        const context = {
          getRecordIds: jest.fn(),
        };

        const webhookExecutor = createWebhookExecutor(action);

        await webhookExecutor(context as unknown as ActionContext);

        expect(superagentMock.post).toHaveBeenCalledWith('https://my-url.com');
        expect(superagentMock.send).toHaveBeenCalledWith({
          action: {
            name: 'myAction',
            scope: 'global',
          },
        });

        expect(context.getRecordIds).not.toHaveBeenCalled();
      });
    });

    describe('when the action scope is single', () => {
      it('should send a request with the action name and the scope', async () => {
        const action = {
          id: 42,
          name: 'myAction',
          modelName: 'myModel',
          type: ModelCustomizationType.action,
          configuration: {
            type: ActionType.webhook,
            scope: ActionScope.single,
            url: 'https://my-url.com',
            integration: 'myIntegration',
          },
        };

        const context = {
          getRecordIds: jest.fn().mockReturnValue([1]),
        };

        const webhookExecutor = createWebhookExecutor(action);

        await webhookExecutor(context as unknown as ActionContext);

        expect(superagentMock.post).toHaveBeenCalledWith('https://my-url.com');
        expect(superagentMock.send).toHaveBeenCalledWith({
          action: {
            name: 'myAction',
            scope: 'single',
          },
          record: {
            id: 1,
          },
        });

        expect(context.getRecordIds).toHaveBeenCalled();
      });

      it('should throw an error if there is no record id', async () => {
        const action = {
          id: 42,
          name: 'myAction',
          modelName: 'myModel',
          type: ModelCustomizationType.action,
          configuration: {
            type: ActionType.webhook,
            scope: ActionScope.single,
            url: 'https://my-url.com',
            integration: 'myIntegration',
          },
        };

        const context = {
          getRecordIds: jest.fn().mockReturnValue([]),
        };

        const webhookExecutor = createWebhookExecutor(action);

        await expect(webhookExecutor(context as unknown as ActionContext)).rejects.toThrow(
          'Single actions can only be used with one selected record',
        );

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });

      it('should throw an error if there is more than one record id', async () => {
        const action = {
          id: 42,
          name: 'myAction',
          modelName: 'myModel',
          type: ModelCustomizationType.action,
          configuration: {
            type: ActionType.webhook,
            scope: ActionScope.single,
            url: 'https://my-url.com',
            integration: 'myIntegration',
          },
        };

        const context = {
          getRecordIds: jest.fn().mockReturnValue([1, 2]),
        };

        const webhookExecutor = createWebhookExecutor(action);

        await expect(webhookExecutor(context as unknown as ActionContext)).rejects.toThrow(
          'Single actions can only be used with one selected record',
        );

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });
    });

    describe('when the action scope is bulk', () => {
      it('should send a request with the action name, the scope and ids', async () => {
        const action = {
          id: 42,
          name: 'myAction',
          modelName: 'myModel',
          type: ModelCustomizationType.action,
          configuration: {
            type: ActionType.webhook,
            scope: ActionScope.bulk,
            url: 'https://my-url.com',
            integration: 'myIntegration',
          },
        };

        const context = {
          getRecordIds: jest.fn().mockReturnValue([1, 2]),
        };

        const webhookExecutor = createWebhookExecutor(action);

        await webhookExecutor(context as unknown as ActionContext);

        expect(superagentMock.post).toHaveBeenCalledWith('https://my-url.com');
        expect(superagentMock.send).toHaveBeenCalledWith({
          action: {
            name: 'myAction',
            scope: 'bulk',
          },
          records: [{ id: 1 }, { id: 2 }],
        });

        expect(context.getRecordIds).toHaveBeenCalled();
      });
    });

    describe('when the scope is unknown', () => {
      it('should throw an error', async () => {
        const action = {
          id: 42,
          name: 'myAction',
          modelName: 'myModel',
          type: ModelCustomizationType.action,
          configuration: {
            type: ActionType.webhook,
            scope: 'unknown' as ActionScope,
            url: 'https://my-url.com',
            integration: 'myIntegration',
          },
        };

        const context = {
          getRecordIds: jest.fn().mockReturnValue([1, 2]),
        };

        const webhookExecutor = createWebhookExecutor(action);

        await expect(webhookExecutor(context as unknown as ActionContext)).rejects.toThrow(
          'Unknown scope: unknown',
        );

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });
    });
  });
});
