import { Plugin } from '@forestadmin/datasource-customizer';
import {
  ActionConfiguration,
  ActionType,
  ModelCustomization,
  ModelCustomizationType,
  UpdateRecordActionConfiguration,
} from '@forestadmin/forestadmin-client';

function getActions<TConfiguration>(
  type: ActionType,
  configuration: ModelCustomization[],
): ModelCustomization<TConfiguration>[] {
  return configuration.filter(
    customization =>
      customization.type === ModelCustomizationType.action &&
      (customization as ModelCustomization<ActionConfiguration>).configuration.type === type,
  ) as ModelCustomization<TConfiguration>[];
}

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

    return Promise.resolve();
  };
}
