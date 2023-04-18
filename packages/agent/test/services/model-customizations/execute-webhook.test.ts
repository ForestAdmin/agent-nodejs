import { ActionContext } from '@forestadmin/datasource-customizer';
import { SchemaUtils } from '@forestadmin/datasource-toolkit';
import { ActionScope } from '@forestadmin/forestadmin-client/src/model-customizations/types';
import superagent from 'superagent';

import { CollectionCustomizer } from '../../../src';
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
        const context = {
          getRecords: jest.fn().mockResolvedValue([{ id1: 1, id2: 2 }]),
        } as unknown as ActionContext;

        const schema = {
          name: 'myModel',
        };

        const collection = {
          schema,
        } as unknown as CollectionCustomizer;

        SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

        await executeWebhook({
          name: 'myAction',
          url: 'https://my-url.com',
          scope: 'Single',
          collection,
          context,
        });

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
        const context = {
          getRecords: jest.fn().mockResolvedValue([]),
        } as unknown as ActionContext;

        const schema = {
          name: 'myModel',
        };

        const collection = {
          schema,
        } as unknown as CollectionCustomizer;

        SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

        await expect(
          executeWebhook({
            name: 'myAction',
            url: 'https://my-url.com',
            scope: 'Single',
            collection,
            context,
          }),
        ).rejects.toThrow('Single actions can only be used with one selected record');

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });

      it('should throw an error if there is more than one record', async () => {
        const context = {
          getRecords: jest.fn().mockResolvedValue([
            { id1: 1, id2: 2 },
            { id1: 3, id2: 4 },
          ]),
        } as unknown as ActionContext;

        const schema = {
          name: 'myModel',
        };

        const collection = {
          schema,
        } as unknown as CollectionCustomizer;

        SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

        await expect(
          executeWebhook({
            name: 'myAction',
            url: 'https://my-url.com',
            scope: 'Single',
            collection,
            context,
          }),
        ).rejects.toThrow('Single actions can only be used with one selected record');

        expect(superagentMock.post).not.toHaveBeenCalled();
        expect(superagentMock.send).not.toHaveBeenCalled();
      });
    });

    describe.each(['Global', 'Bulk'] as ActionScope[])(
      'when the action scope is %s',
      (scope: ActionScope) => {
        it('should send a request with the action name, the scope and ids', async () => {
          const context = {
            getRecords: jest.fn().mockReturnValue([
              { id1: 1, id2: 2 },
              { id1: 3, id2: 4 },
            ]),
          } as unknown as ActionContext;

          const schema = {
            name: 'myModel',
          };

          const collection = {
            schema,
          } as unknown as CollectionCustomizer;

          SchemaUtilsMock.getPrimaryKeys.mockReturnValue(['id1', 'id2']);

          await executeWebhook({
            name: 'myAction',
            url: 'https://my-url.com',
            scope,
            collection,
            context,
          });

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
