export enum ModelCustomizationType {
  action = 'action',
}

export enum ActionScope {
  global = 'global',
  single = 'single',
  bulk = 'bulk',
}

export enum ActionType {
  webhook = 'webhook',
}

export type ModelCustomization<TConfiguration> = {
  id: number;
  name: string;
  type: `${ModelCustomizationType}`;
  modelName: string;
  configuration: TConfiguration;
};

export type ActionConfiguration = {
  scope: `${ActionScope}`;
  type: `${ActionType}`;
};

export type WebhookActionConfiguration = ActionConfiguration & {
  type: `${ActionType.webhook}`;
  url: string;
  integration: string;
};

export interface ModelCustomizationService {
  getConfiguration(): Promise<ModelCustomization<unknown>[]>;
}
