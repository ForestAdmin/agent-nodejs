export enum ModelCustomizationType {
  action = 'action',
}

export type ActionScopeApi = 'global' | 'single' | 'bulk';
export type ActionScope = 'Global' | 'Single' | 'Bulk';

export type ActionType = 'webhook';

export type ModelCustomization<TConfiguration = unknown> = {
  name: string;
  type: `${ModelCustomizationType}`;
  modelName: string;
  configuration: TConfiguration;
};

export type ActionConfigurationApi<TActionConfigurationSpecific = unknown> = {
  scope: ActionScopeApi;
  type: ActionType;
  configuration: TActionConfigurationSpecific;
};

export type WebhookActionConfigurationSpecific = {
  url: string;
  integration: string;
};

export type WebhookActionConfigurationApi =
  ActionConfigurationApi<WebhookActionConfigurationSpecific> & {
    type: 'webhook';
  };

export type ActionConfiguration<TActionConfigurationSpecific = unknown> = {
  scope: ActionScope;
  type: ActionType;
  configuration: TActionConfigurationSpecific;
};

export type WebhookActionConfiguration = ActionConfiguration<WebhookActionConfigurationSpecific> & {
  type: 'webhook';
};
export interface ModelCustomizationService {
  getConfiguration(): Promise<ModelCustomization[]>;
}

export type WebhookAction = ModelCustomization<WebhookActionConfiguration>;
