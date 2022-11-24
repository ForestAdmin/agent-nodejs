import { Client } from 'openid-client';

import AuthService from './auth';
import { UserInfo } from './auth/types';
import ChartHandler from './charts/chart-handler';
import IpWhiteListService from './ip-whitelist';
import { IpWhitelistConfiguration } from './ip-whitelist/types';
import RenderingPermissionService from './permissions/rendering-permission';
import { RawTree } from './permissions/types';
import verifyAndExtractApproval from './permissions/verify-approval';
import SchemaService from './schema';
import { ForestServerCollection } from './schema/types';
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
    protected readonly ipWhitelistService: IpWhiteListService,
    protected readonly schemaService: SchemaService,
    protected readonly authService: AuthService,
  ) {}

  verifySignedActionParameters<TSignedParameters>(signedParameters: string): TSignedParameters {
    return verifyAndExtractApproval(signedParameters, this.options.envSecret);
  }

  getIpWhitelistConfiguration(): Promise<IpWhitelistConfiguration> {
    return this.ipWhitelistService.getConfiguration();
  }

  async postSchema(
    schema: ForestServerCollection[],
    agentName: string,
    agentVersion: string,
  ): Promise<boolean> {
    return this.schemaService.postSchema(schema, agentName, agentVersion);
  }

  getOpenIdClient(): Promise<Client> {
    return this.authService.getOpenIdClient();
  }

  getUserInfo(renderingId: number, accessToken: string): Promise<UserInfo> {
    return this.authService.getUserInfo(renderingId, accessToken);
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
    this.renderingPermissionService.invalidateCache(renderingId);
  }
}
