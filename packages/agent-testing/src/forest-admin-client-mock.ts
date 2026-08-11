import type {
  ChartHandlerInterface,
  ContextVariablesInstantiatorInterface,
  ForestAdminClient,
  IpWhitelistConfiguration,
  ModelCustomizationService,
  UserInfo,
} from '@forestadmin/forestadmin-client';

export type UserInfoToSupportAnyAgents = UserInfo & {
  roleId: number;
  rendering_id: number;
  first_name: string;
  last_name: string;
  permission_level: string;
  role_id: number;
};

export const CURRENT_USER: UserInfoToSupportAnyAgents = {
  id: 1,
  email: 'forest@forest.com',
  team: 'admin',

  rendering_id: 1,
  renderingId: 1,

  first_name: 'forest',
  firstName: 'forest',

  last_name: 'admin',
  lastName: 'admin',

  role: 'Admin',

  permissionLevel: 'admin',
  permission_level: 'admin',

  tags: {},

  roleId: 1,
  role_id: 1,
};

export default class ForestAdminClientMock implements ForestAdminClient {
  readonly chartHandler: ChartHandlerInterface;
  readonly contextVariablesInstantiator: ContextVariablesInstantiatorInterface = {
    buildContextVariables: () => ({} as any), // TODO: return actual context variables
  };

  readonly modelCustomizationService: ModelCustomizationService;
  readonly mcpServerConfigService: ForestAdminClient['mcpServerConfigService'] = {
    getConfiguration: () => Promise.resolve({}),
  };

  readonly schemaService: ForestAdminClient['schemaService'] = {
    getSchema: () => Promise.resolve([]),
  };

  readonly activityLogsService: ForestAdminClient['activityLogsService'] = {
    createActivityLog: () => Promise.resolve({ id: '1', attributes: { index: '1' } }),
    createMcpActivityLog: () => Promise.resolve({ id: '1', attributes: { index: '1' } }),
    updateActivityLogStatus: () => Promise.resolve(),
  };

  readonly workflowsService: ForestAdminClient['workflowsService'] = {
    listMcpEnabledWorkflows: () => Promise.resolve([]),
    getMcpWorkflowById: () =>
      Promise.resolve({
        workflowId: 'wf-1',
        name: 'Refund order',
        collectionName: 'orders',
        mcpEnabled: true,
      }),
    triggerMcpWorkflow: () => Promise.resolve({ runId: '1', runState: 'loading' }),
    getMcpWorkflowRun: () =>
      Promise.resolve({
        id: 1,
        userId: 1,
        renderingId: 1,
        collectionId: 'orders',
        workflowId: 'wf-1',
        bpmnVersion: '1',
        selectedRecordId: '1',
        runState: 'loading',
        engine: 'orchestrator',
        triggerType: 'mcp',
        lockedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        workflowHistory: [],
      }),
  };

  readonly permissionService: any;
  readonly authService: any;

  constructor() {
    this.permissionService = {
      canOnCollection: () => true,
      canTriggerCustomAction: () => true,
      doesTriggerCustomActionRequiresApproval: () => false,
      canApproveCustomAction: () => true,
      canRequestCustomActionParameters: () => true,
      canExecuteChart: () => true,
      canExecuteSegmentQuery: () => true,
      getConditionalTriggerCondition: () => undefined,
      getConditionalRequiresApprovalCondition: () => undefined,
      getConditionalApproveCondition: () => undefined,
      getConditionalApproveConditions: () => undefined,
      getRoleIdsAllowedToApproveWithoutConditions: () => undefined,
    };
    this.authService = {
      init: () => Promise.resolve(undefined),
      getUserInfo: () => Promise.resolve<UserInfo>(CURRENT_USER),
      generateAuthorizationUrl: () => Promise.resolve(undefined),
      generateTokens: () => Promise.resolve({ accessToken: 'AUTH-TOKEN' }),
    };
  }

  close(): void {
    // Do nothing
  }

  getIpWhitelistConfiguration(): Promise<IpWhitelistConfiguration> {
    return Promise.resolve({ isFeatureEnabled: false, ipRules: [] });
  }

  getScope(): Promise<undefined> {
    return Promise.resolve<undefined>(undefined);
  }

  markScopesAsUpdated(): void {
    // Do nothing
  }

  onRefreshCustomizations(): void {
    // Do nothing
  }

  postSchema(): Promise<boolean> {
    return Promise.resolve(true);
  }

  subscribeToServerEvents(): Promise<void> {
    return Promise.resolve();
  }

  verifySignedActionParameters<TSignedParameters>(): TSignedParameters {
    return undefined;
  }
}
