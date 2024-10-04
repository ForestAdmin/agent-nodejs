import { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import AuthService from '../auth';
import { ModelCustomization } from '../model-customizations/types';
import {
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestAdminServerInterface,
} from '../types';
import ServerUtils from '../utils/server';

export type NotificationFromAgent = {
  payload: {
    refresh?: { collectionName: string; recordIds?: string[] };
    message?: { type: 'success' | 'info' | 'warning' | 'error'; text: string };
  };
  target: {
    roles: string[];
    team: string;
  };
};

export type HttpOptions = Pick<
  ForestAdminClientOptionsWithDefaults,
  'envSecret' | 'forestServerUrl'
>;

export type NotificationFromAgent =
  | { target: { users: string[] } }
  | { refresh: { collectionName: string; recordIds?: string[] } }
  | { message: { type: 'success' | 'info' | 'warning' | 'error'; text: string } };

export default class ForestHttpApi implements ForestAdminServerInterface {
  async getEnvironmentPermissions(options: HttpOptions): Promise<EnvironmentPermissionsV4> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/environment');
  }

  async getUsers(options: HttpOptions): Promise<UserPermissionV4[]> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/users');
  }

  async notifyFromAgent(options: HttpOptions, payload: NotificationFromAgent): Promise<void> {
    return ServerUtils.query(
      options,
      'post',
      '/liana/notifications-from-agent',
      {},
      { notification: payload },
    );
  }

  async getRenderingPermissions(
    renderingId: number,
    options: HttpOptions,
  ): Promise<RenderingPermissionV4> {
    return ServerUtils.query(options, 'get', `/liana/v4/permissions/renderings/${renderingId}`);
  }

  async getModelCustomizations(options: HttpOptions): Promise<ModelCustomization[]> {
    return ServerUtils.query<ModelCustomization[]>(options, 'get', '/liana/model-customizations');
  }

  makeAuthService(options: Required<ForestAdminClientOptions>): ForestAdminAuthServiceInterface {
    return new AuthService(options);
  }

  async notifyFromAgent(options: HttpOptions, payload: NotificationFromAgent) {
    await ServerUtils.query(options, 'post', `/liana/notifications-from-agent`, {}, payload);
  }
}
