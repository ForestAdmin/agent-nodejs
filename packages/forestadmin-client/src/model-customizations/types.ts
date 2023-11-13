export enum ModelCustomizationType {
  action = 'action',
}

export type ActionScopeApi = 'global' | 'single' | 'bulk';
export type ActionScope = 'Global' | 'Single' | 'Bulk';

export type ActionType = 'webhook' | 'update-record';

export type ModelCustomization<TConfiguration = unknown> = {
  name: string;
  type: `${ModelCustomizationType}`;
  modelName: string;
  configuration: TConfiguration;
};

export type ConfigurationApi<TConfigurationSpecific = unknown> = {
  type: string;
  configuration: TConfigurationSpecific;
};

export type ActionConfigurationApi<TActionConfigurationSpecific = unknown> = {
  scope: ActionScopeApi;
  type: ActionType;
  configuration: TActionConfigurationSpecific;
};

export type ActionConfiguration<TActionConfigurationSpecific = unknown> = {
  scope: ActionScope;
  type: ActionType;
  configuration: TActionConfigurationSpecific;
};

export type WebhookActionConfigurationSpecific = {
  url: string;
  integration: string;
};

export type WebhookActionConfiguration = ActionConfiguration<WebhookActionConfigurationSpecific> & {
  type: 'webhook';
};

export type UpdateRecordActionConfigurationSpecific = {
  fields: Array<{ fieldName: string; value: unknown }>;
};

export type UpdateRecordActionConfiguration =
  ActionConfiguration<UpdateRecordActionConfigurationSpecific> & {
    type: 'update-record';
  };

export interface ModelCustomizationService {
  getConfiguration(): Promise<ModelCustomization[]>;
}

export type WebhookAction = ModelCustomization<WebhookActionConfiguration>;

export type UpdateRecordAction = ModelCustomization<UpdateRecordActionConfiguration>;
