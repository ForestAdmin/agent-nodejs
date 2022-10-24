import type { Collection, GenericTree } from '@forestadmin/datasource-toolkit';

import {
  ForestAdminClient,
  ForestAdminClientOptionsWithDefaults,
  PermissionService,
} from './types';
import ChartHandler from './charts/chart-handler';
import ContextVariablesInjector from './utils/context-variables-injector';
import RenderingPermissionService from './permissions/rendering-permission';
import verifyAndExtractApproval from './permissions/verify-approval';

export default class ForestAdminClientWithCache implements ForestAdminClient {
  constructor(
    protected readonly options: ForestAdminClientOptionsWithDefaults,
    public readonly permissionService: PermissionService,
    protected readonly renderingPermissionService: RenderingPermissionService,
    public readonly contextVariablesInjector: ContextVariablesInjector,
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
    collection,
  }: {
    renderingId: number | string;
    userId: number | string;
    collection: Collection;
  }): Promise<GenericTree> {
    return this.renderingPermissionService.getScope({
      renderingId,
      collection,
      userId,
    });
  }

  public markScopesAsUpdated(renderingId: number | string) {
    this.renderingPermissionService.invalidateCache(renderingId);
  }
}
