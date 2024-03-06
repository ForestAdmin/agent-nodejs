import { ActionContext, CollectionCustomizer } from '@forestadmin/datasource-customizer';
import { ActionScope } from '@forestadmin/datasource-toolkit';
import {
  ActionType,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client/src/model-customizations/types';

import executeUpdateRecord from '../../../../../src/services/model-customizations/actions/update-record/execute-update-record';
import UpdateRecordActionsPlugin from '../../../../../src/services/model-customizations/actions/update-record/update-record-plugin';
import dataSourceCustomizerFactory from '../../../../__factories__/datasource-customizer';

jest.mock(
  '../../../../../src/services/model-customizations/actions/update-record/execute-update-record',
  () => ({
    __esModule: true,
    default: jest.fn(),
  }),
);

const executeWebhookMock = executeUpdateRecord as jest.Mock;

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
            configuration: { fields: [{ fieldName: 'field', value: 'value' }] },
          },
        };

        const collection = {
          addAction: jest.fn(),
          name: 'myModel',
        };
        const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
        jest
          .spyOn(customizer, 'findCollection')
          .mockReturnValue(collection as unknown as CollectionCustomizer);

        UpdateRecordActionsPlugin.addUpdateRecordActions(
          customizer,
          undefined as unknown as CollectionCustomizer,
          [action],
        );

        expect(collection.addAction).toHaveBeenCalledWith('myAction', {
          scope,
          execute: expect.any(Function),
        });
        expect(customizer.findCollection).toHaveBeenCalledWith('myModel');
      },
    );

    it('should do nothing if the collection is missing', async () => {
      const action = {
        name: 'myAction',
        type: ModelCustomizationType.action,
        modelName: 'myOtherModel',
        configuration: {
          type: 'update-record',
          scope: 'Global',
          configuration: { fields: [{ fieldName: 'field', value: 'value' }] },
        },
      };

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };
      jest
        .spyOn(customizer, 'findCollection')
        .mockReturnValue(undefined as unknown as CollectionCustomizer);

      UpdateRecordActionsPlugin.addUpdateRecordActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [action],
      );

      expect(collection.addAction).not.toHaveBeenCalled();
      expect(customizer.findCollection).toHaveBeenCalledWith('myOtherModel');
    });

    it('should execute the action', async () => {
      const action = {
        name: 'myAction',
        type: ModelCustomizationType.action,
        modelName: 'myModel',
        configuration: {
          type: 'update-record',
          scope: 'Global',
          configuration: { fields: [{ fieldName: 'field', value: 'value' }] },
        },
      };

      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };
      jest
        .spyOn(customizer, 'findCollection')
        .mockReturnValue(collection as unknown as CollectionCustomizer);

      UpdateRecordActionsPlugin.addUpdateRecordActions(
        customizer,
        undefined as unknown as CollectionCustomizer,
        [action],
      );

      const { execute } = collection.addAction.mock.calls[0][1];

      const context = {
        filter: 'filter',
      } as unknown as ActionContext;

      await execute(context);

      expect(customizer.findCollection).toHaveBeenCalledWith('myModel');
      expect(executeWebhookMock).toHaveBeenCalledWith(action, context);
    });

    it('should not use actions that are not update records', async () => {
      const customizer = dataSourceCustomizerFactory.mockAllMethods().build();
      const collection = {
        addAction: jest.fn(),
        name: 'myModel',
      };
      jest
        .spyOn(customizer, 'findCollection')
        .mockReturnValue(collection as unknown as CollectionCustomizer);

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
      expect(customizer.findCollection).not.toHaveBeenCalled();
    });
  });
});
