import type { Plugin } from '@forestadmin/datasource-customizer';
import type {
  ModelCustomization,
  UpdateRecordActionConfiguration,
} from '@forestadmin/forestadmin-client';

import executeUpdateRecord from './execute-update-record';
import getActions from '../get-actions';

export default class UpdateRecordActionsPlugin {
  public static VERSION = '1.0.0';
  public static FEATURE = 'update-record-actions';

  public static addUpdateRecordActions: Plugin<ModelCustomization[]> = (
    datasourceCustomizer,
    _,
    modelCustomizations,
  ) => {
    const actions = getActions<UpdateRecordActionConfiguration>(
      'update-record',
      modelCustomizations,
    );

    actions.forEach(action => {
      const collection = datasourceCustomizer.findCollection(action.modelName);
      if (!collection) return;

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: context => executeUpdateRecord(action, context),
      });
    });
  };
}
