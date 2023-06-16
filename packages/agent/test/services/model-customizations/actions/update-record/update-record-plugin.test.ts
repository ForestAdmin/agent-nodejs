import { ActionContext, CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { ActionScope } from '@forestadmin/datasource-toolkit';
import {
  ActionType,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';

import UpdateRecordActionsPlugin from '../../../../../src/services/model-customizations/actions/update-record/update-record-plugin';
import dataSourceCustomizerFactory from '../../../../__factories__/datasource-customizer';

describe('Services > ModelCustomizations > Actions > UpdateRecordActionsPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('static addUpdateRecordActions', () => {
    it.each(['Global', 'Single', 'Bulk'] as ActionScope[])(
      'should register an update record action with the scope %s',
      scope => {
        const action = {
          name: 'myAction',
          type: ModelCustomizationType.action,
          modelName: 'myModel',
          configuration: {
            type: 'update-record',
            scope,
            configuration: { fields: { field: 'value' } },
          },
        };

        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        const collection = {
          addAction: jest.fn(),
        };
        (customizer.getCollection as jest.Mock).mockReturnValue(collection);

        UpdateRecordActionsPlugin.addUpdateRecordActions(
          customizer,
          undefined as unknown as CollectionCustomizer,
          [action],
        );

        expect(collection.addAction).toHaveBeenCalledWith('myAction', {
          scope,
          execute: expect.any(Function),
        });
        expect(customizer.getCollection).toHaveBeenCalledWith('myModel');
      },
    );

    it('should execute the action', async () => {
      const action = {
        name: 'myAction',
        type: ModelCustomizationType.action,
        modelName: 'myModel',
        configuration: {
          type: 'update-record',
          scope: 'Global',
          configuration: { fields: { field: 'value' } },
        },
      };

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      UpdateRecordActionsPlugin.addUpdateRecordActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [action],
      );

      const { execute } = collection.addAction.mock.calls[0][1];

      const context = {
        filter: 'filter',
        collection: { update: jest.fn() },
      } as unknown as ActionContext;

      await execute(context);

      expect(context.collection.update).toHaveBeenCalledWith('filter', { field: 'value' });
    });

    it('should not use actions that are not update records', async () => {
      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
      };
      (customizer.getCollection as jest.Mock).mockReturnValue(collection);

      UpdateRecordActionsPlugin.addUpdateRecordActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [
          {
            name: 'myAction',
            type: ModelCustomizationType.action,
            modelName: 'myModel',
            configuration: {
              type: 'other' as ActionType,
              scope: 'Global',
              configuration: { other: 1 },
            },
          },
        ],
      );

      expect(collection.addAction).not.toHaveBeenCalled();
    });
  });
});
