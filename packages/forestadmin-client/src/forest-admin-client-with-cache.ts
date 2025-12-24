import type ChartHandler from './charts/chart-handler';
import type {
  BaseEventsSubscriptionService,
  RefreshEventsHandlerService,
} from './events-subscription/types';
import type IpWhiteListService from './ip-whitelist';
import type { IpWhitelistConfiguration } from './ip-whitelist/types';
import type { McpServerConfigService } from './mcp-server-config';
import type { ModelCustomizationService } from './model-customizations/types';
import type RenderingPermissionService from './permissions/rendering-permission';
import type { RawTree } from './permissions/types';
import type SchemaService from './schema';
import type { ForestSchema } from './schema/types';
import type {
  ForestAdminAuthServiceInterface,
  ForestAdminClient,
  ForestAdminClientOptionsWithDefaults,
  PermissionService,
} from './types';
import type ContextVariablesInstantiator from './utils/context-variables-instantiator';

import verifyAndExtractApproval from './permissions/verify-approval';

export default class ForestAdminClientWithCache implements ForestAdminClient {
  constructor(
    protected readonly options: ForestAdminClientOptionsWithDefaults,
    public readonly permissionService: PermissionService,
    protected readonly renderingPermissionService: RenderingPermissionService,
    public readonly contextVariablesInstantiator: ContextVariablesInstantiator,
    public readonly chartHandler: ChartHandler,
    protected readonly ipWhitelistService: IpWhiteListService,
    protected readonly schemaService: SchemaService,
    public readonly authService: ForestAdminAuthServiceInterface,
    public readonly modelCustomizationService: ModelCustomizationService,
    public readonly mcpServerConfigService: McpServerConfigService,
    protected readonly eventsSubscription: BaseEventsSubscriptionService,
    protected readonly eventsHandler: RefreshEventsHandlerService,
  ) {}

  verifySignedActionParameters<TSignedParameters>(signedParameters: string): TSignedParameters {
    return verifyAndExtractApproval(signedParameters, this.options.envSecret);
  }

  getIpWhitelistConfiguration(): Promise<IpWhitelistConfiguration> {
    return this.ipWhitelistService.getConfiguration();
  }

  async postSchema(schema: ForestSchema): Promise<boolean> {
    return this.schemaService.postSchema(schema);
  }

  public async getScope({
    renderingId,
    userId,
    collectionName,
  }: {
    renderingId: number | string;
    userId: number | string;
    collectionName: string;
  }): Promise<RawTree> {
    return this.renderingPermissionService.getScope({
      renderingId,
      collectionName,
      userId,
    });
  }

  public markScopesAsUpdated(renderingId: number | string) {
    if (!this.options.instantCacheRefresh) {
      this.renderingPermissionService.invalidateCache(renderingId);
    }
  }

  public async subscribeToServerEvents() {
    await this.eventsSubscription.subscribeEvents();
  }

  public close() {
    this.eventsSubscription.close();
  }

  public onRefreshCustomizations(handler: () => void | Promise<void>) {
    if (this.options.experimental) this.eventsHandler.onRefreshCustomizations(handler);
  }
}
