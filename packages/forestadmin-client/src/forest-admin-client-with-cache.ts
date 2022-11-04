import ChartHandler from './charts/chart-handler';
import RenderingPermissionService from './permissions/rendering-permission';
import verifyAndExtractApproval from './permissions/verify-approval';
import {
  ForestAdminClient,
  ForestAdminClientOptionsWithDefaults,
  PermissionService,
} from './types';
import ContextVariablesInstantiator from './utils/context-variables-instantiator';

export default class ForestAdminClientWithCache implements ForestAdminClient {
  constructor(
    protected readonly options: ForestAdminClientOptionsWithDefaults,
    public readonly permissionService: PermissionService,
    protected readonly renderingPermissionService: RenderingPermissionService,
    public readonly contextVariablesInstantiator: ContextVariablesInstantiator,
    public readonly chartHandler: ChartHandler,
  ) {}

  public verifySignedActionParameters<TSignedParameters>(
    signedParameters: string,
  ): TSignedParameters {
    return verifyAndExtractApproval(signedParameters, this.options.envSecret);
  }

  public async getScope({
    renderingId,
    userId,
    collectionName,
  }: {
    renderingId: number | string;
    userId: number | string;
    collectionName: string;
  }): Promise<GenericTree> {
    return this.renderingPermissionService.getScope({
      renderingId,
      collectionName,
      userId,
    });
  }

  public markScopesAsUpdated(renderingId: number | string) {
    this.renderingPermissionService.invalidateCache(renderingId);
  }
}
