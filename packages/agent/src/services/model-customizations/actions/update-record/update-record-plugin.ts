import { Plugin } from '@forestadmin/datasource-customizer';
import {
  ModelCustomization,
  UpdateRecordActionConfiguration,
} from '@forestadmin/forestadmin-client';

import getActions from '../get-actions';

export default class UpdateRecordActionsPlugin {
  public static VERSION = '1.0.0';
  public static FEATURE = 'update-record-actions';

  public static addUpdateRecord: Plugin<ModelCustomization[]> = (
    datasourceCustomizer,
    _,
    modelCustomizations,
  ) => {
    const actions = getActions<UpdateRecordActionConfiguration>(
      'update-record',
      modelCustomizations,
    );
    actions.forEach(action => {
      const collection = datasourceCustomizer.getCollection(action.modelName);

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: async context => {
          const {
            configuration: {
              configuration: { fields },
            },
          } = action;

          await context.collection.update(context.filter, fields);
        },
      });
    });
  };
}
