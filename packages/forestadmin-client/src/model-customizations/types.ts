export enum ModelCustomizationType {
  action = 'action',
}

export type ActionScopeApi = 'global' | 'single' | 'bulk';
export type ActionScope = 'Global' | 'Single' | 'Bulk';

export type ActionType = 'webhook';

export type ModelCustomization<TConfiguration> = {
  id: number;
  name: string;
  type: `${ModelCustomizationType}`;
  modelName: string;
  configuration: TConfiguration;
};

export type ActionConfigurationApi = {
  scope: ActionScopeApi;
  type: ActionType;
};

export type WebhookActionConfigurationApi = ActionConfigurationApi & {
  type: 'webhook';
  url: string;
  integration: string;
};

export type ActionConfiguration = {
  scope: ActionScope;
  type: ActionType;
};

export type WebhookActionConfiguration = ActionConfiguration & {
  type: 'webhook';
  url: string;
  integration: string;
};
export interface ModelCustomizationService {
  getConfiguration(): Promise<ModelCustomization<unknown>[]>;
}
