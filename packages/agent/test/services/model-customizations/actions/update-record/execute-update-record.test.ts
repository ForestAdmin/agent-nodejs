import { ActionContext } from '@forestadmin/datasource-customizer';
import { BusinessError } from '@forestadmin/datasource-toolkit';
import { UpdateRecordAction } from '@forestadmin/forestadmin-client/src/model-customizations/types';

import executeUpdateRecord from '../../../../../src/services/model-customizations/actions/update-record/execute-update-record';

describe('Services > ModelCustomizations > Actions > ExecuteUpdateRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeUpdateRecord', () => {
    const action: UpdateRecordAction = {
      name: 'myAction',
      type: 'action',
      modelName: 'myModel',
      configuration: {
        type: 'update-record',
        scope: 'Global',
        configuration: { fields: [{ fieldName: 'field', value: 'value' }] },
      },
    };

    it('should update the collection records that match the filter', async () => {
      const context = {
        filter: 'filter',
        collection: { update: jest.fn() },
      } as unknown as ActionContext;

      await executeUpdateRecord(action, context);

      expect(context.collection.update).toHaveBeenCalledWith('filter', { field: 'value' });
    });

    describe('when an error occurred', () => {
      describe('with a managed error (BusinessError)', () => {
        it('should return an error result', async () => {
          const context = {
            filter: 'filter',
            collection: { update: jest.fn().mockRejectedValue(new BusinessError('Managed error')) },
          } as unknown as ActionContext;

          const result = await executeUpdateRecord(action, context);

          expect(result).toStrictEqual({
            message:
              'The no-code action <strong>myAction</strong> cannot be triggered due to a misconfiguration. Please contact your administrator.<br/>(BusinessError: Managed error)',
            type: 'Error',
          });
        });
      });

      describe('with an unmanaged error', () => {
        it('should return an error result without error any details (avoid leaks)', async () => {
          const context = {
            filter: 'filter',
            collection: { update: jest.fn().mockRejectedValue(new Error('Unmanaged error')) },
          } as unknown as ActionContext;

          const result = await executeUpdateRecord(action, context);

          expect(result).toStrictEqual({
            message:
              'The no-code action <strong>myAction</strong> cannot be triggered due to a misconfiguration. Please contact your administrator.',
            type: 'Error',
          });
        });
      });
    });
  });
});
