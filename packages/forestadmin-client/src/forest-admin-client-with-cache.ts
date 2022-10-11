import type { GenericTree } from '@forestadmin/datasource-toolkit';

import {
  ForestAdminClient,
  ForestAdminClientOptionsWithDefaults,
  PermissionService,
} from './types';
import { User } from './permissions/types';
import RenderingPermissionService from './permissions/rendering-permission';
import verifyAndExtractApproval from './permissions/verify-approval';

export default class ForestAdminClientWithCache implements ForestAdminClient {
  constructor(
    protected readonly options: ForestAdminClientOptionsWithDefaults,
    public readonly permissionService: PermissionService,
    protected readonly renderingPermissionService: RenderingPermissionService,
  ) {}

  public verifySignedActionParameters<TSignedParameters>(
    signedParameters: string,
  ): TSignedParameters {
    return verifyAndExtractApproval(signedParameters, this.options.envSecret);
  }

  public async getScope({
    renderingId,
    user,
    collectionName,
  }: {
    renderingId: number;
    user: User;
    collectionName: string;
  }): Promise<GenericTree> {
    return this.renderingPermissionService.getScope({
      renderingId,
      collectionName,
      user,
    });
  }

  public markScopesAsUpdated(renderingId: number) {
    this.renderingPermissionService.invalidateCache(renderingId);
  }
}
