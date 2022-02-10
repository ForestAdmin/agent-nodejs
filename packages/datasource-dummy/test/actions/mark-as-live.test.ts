import { ActionResponseType } from '@forestadmin/datasource-toolkit';

import MarkAsLiveAction from '../../src/actions/mark-as-live';

describe('DummyDataSource > Actions > MarkAsLiveAction', () => {
  it('should instanciate properly', () => {
    expect(new MarkAsLiveAction()).toBeDefined();
  });

  describe('execute', () => {
    it('should resolve with a SuccessResponse', async () => {
      await expect(new MarkAsLiveAction().execute({ value: 42 })).resolves.toMatchObject({
        type: ActionResponseType.Success,
        message: 'Record set as active',
        options: {
          type: 'text',
        },
      });
    });
  });

  describe('getForm', () => {
    it('should resolve with an empty ActionForm', async () => {
      await expect(new MarkAsLiveAction().getForm()).resolves.toMatchObject({
        fields: [],
      });
    });
  });
});
