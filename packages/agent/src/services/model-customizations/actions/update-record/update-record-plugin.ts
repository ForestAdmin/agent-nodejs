import { ActionContext, Plugin } from '@forestadmin/datasource-customizer';
import { RecordValidator } from '@forestadmin/datasource-toolkit';
import {
  ModelCustomization,
  UpdateRecordActionConfiguration,
} from '@forestadmin/forestadmin-client';

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
      const collection = datasourceCustomizer.getCollection(action.modelName);

      collection.addAction(action.name, {
        scope: action.configuration.scope,
        execute: async (context: ActionContext) => {
          const {
            configuration: {
              configuration: { fields },
            },
          } = action;

          // Validate the fields before updating them.
          // @ts-expect-error: accessing private property but we don't want user to access it
          RecordValidator.validate(context.collection.collection, fields);

          await context.collection.update(context.filter, fields);
        },
      });
    });
  };
}
