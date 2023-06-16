import {
  ActionConfiguration,
  ActionType,
  ModelCustomization,
  ModelCustomizationType,
} from '@forestadmin/forestadmin-client';

export default function getActions<TConfiguration extends ActionConfiguration>(
  type: ActionType,
  configuration: ModelCustomization[],
): ModelCustomization<TConfiguration>[] {
  return configuration.filter(
    customization =>
      customization.type === ModelCustomizationType.action &&
      (customization as ModelCustomization<TConfiguration>).configuration.type === type,
  ) as ModelCustomization<TConfiguration>[];
}
