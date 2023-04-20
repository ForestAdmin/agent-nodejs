import { ActionContext } from '@forestadmin/datasource-customizer';
import { SchemaUtils } from '@forestadmin/datasource-toolkit';
import {
  ActionScope,
  WebhookAction,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';
import superagent from 'superagent';

import executeWebhook from '../../../src/services/model-customizations/execute-webhook';

jest.mock('superagent', () => ({
  post: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
}));

jest.mock('@forestadmin/datasource-toolkit', () => ({
  SchemaUtils: {
    getPrimaryKeys: jest.fn(),
  },
}));

const superagentMock = superagent as unknown as {
  post: jest.Mock;
  send: jest.Mock;
};

const SchemaUtilsMock = SchemaUtils as unknown as {
  getPrimaryKeys: jest.Mock;
};

describe('Services > ModelCustomizations > WebhookExecutor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeWebhook', () => {
    describe('when the action scope is single', () => {
      it('should send a request with the action name and the scope', async () => {
        const action: WebhookAction = {
          name: 'myAction',
          modelName: 'myModel',
          type: 'action',
          configuration: {
            type: 'webhook',
            url: 'https://my-url.com',
            scope: 'Single',
            integration: 'forest',
          },
        };

        const schema = {
          name: 'myModel',
        };

        const context = {
          getRecords: jest.fn().mockResolvedValue([{ id1: 1, id2: 2 }]),
          collection: { schema },
        } as unknown as ActionContext;

        SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

        await executeWebhook(action, context);

        expect(superagentMock.post).toHaveBeenCalledWith('https://my-url.com');
        expect(superagentMock.send).toHaveBeenCalledWith({
          action: {
            name: 'myAction',
            scope: 'single',
          },
          record: { id1: 1, id2: 2 },
        });

        expect(context.getRecords).toHaveBeenCalled();
      });

      it('should throw an error if there is no record', async () => {
        const action: WebhookAction = {
          name: 'myAction',
          modelName: 'myModel',
          type: 'action',
          configuration: {
            type: 'webhook',
            url: 'https://my-url.com',
            scope: 'Single',
            integration: 'forest',
          },
        };

        const context = {
          getRecords: jest.fn().mockResolvedValue([]),
          collection: {
            schema: {
              name: 'myModel',
            },
          },
        } as unknown as ActionContext;

        SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

        await expect(executeWebhook(action, context)).rejects.toThrow(
          'Single actions can only be used with one selected record',
        );

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });

      it('should throw an error if there is more than one record', async () => {
        const action: WebhookAction = {
          name: 'myAction',
          modelName: 'myModel',
          type: 'action',
          configuration: {
            type: 'webhook',
            url: 'https://my-url.com',
            scope: 'Single',
            integration: 'forest',
          },
        };

        const context = {
          getRecords: jest.fn().mockResolvedValue([
            { id1: 1, id2: 2 },
            { id1: 3, id2: 4 },
          ]),
          collection: {
            schema: {
              name: 'myModel',
            },
          },
        } as unknown as ActionContext;

        SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

        await expect(executeWebhook(action, context)).rejects.toThrow(
          'Single actions can only be used with one selected record',
        );

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });
    });

    describe.each(['Global', 'Bulk'] as ActionScope[])(
      'when the action scope is %s',
      (scope: ActionScope) => {
        it('should send a request with the action name, the scope and ids', async () => {
          const action: WebhookAction = {
            name: 'myAction',
            modelName: 'myModel',
            type: 'action',
            configuration: {
              type: 'webhook',
              url: 'https://my-url.com',
              scope,
              integration: 'forest',
            },
          };

          const schema = {
            name: 'myModel',
          };

          const context = {
            getRecords: jest.fn().mockReturnValue([
              { id1: 1, id2: 2 },
              { id1: 3, id2: 4 },
            ]),
            collection: {
              schema,
            },
          } as unknown as ActionContext;

          SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

          await executeWebhook(action, context);

          expect(superagentMock.post).toHaveBeenCalledWith('https://my-url.com');
          expect(superagentMock.send).toHaveBeenCalledWith({
            action: {
              name: 'myAction',
              scope: scope.toLowerCase(),
            },
            records: [
              { id1: 1, id2: 2 },
              { id1: 3, id2: 4 },
            ],
          });

          expect(context.getRecords).toHaveBeenCalledTimes(1);
          expect(context.getRecords).toHaveBeenCalledWith(['id1', 'id2']);
        });
      },
    );
  });
});
