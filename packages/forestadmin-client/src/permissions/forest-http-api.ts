import superagent, { ResponseError } from 'superagent';

import { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';

type HttpOptions = Pick<ForestAdminClientOptionsWithDefaults, 'envSecret' | 'forestServerUrl'>;

export default class ForestHttpApi {
  static async getEnvironmentPermissions(options: HttpOptions): Promise<EnvironmentPermissionsV4> {
    try {
      const { body } = await superagent
        .get(`${options.forestServerUrl}/liana/v4/permissions/environment`)
        .set('forest-secret-key', options.envSecret);

      return body;
    } catch (e) {
      this.handleResponseError(e);
    }
  }

  static async getUsers(options: HttpOptions): Promise<UserPermissionV4[]> {
    try {
      const { body } = await superagent
        .get(`${options.forestServerUrl}/liana/v4/permissions/users`)
        .set('forest-secret-key', options.envSecret);

      return body;
    } catch (e) {
      this.handleResponseError(e);
    }
  }

  static async getRenderingPermissions(
    renderingId: number,
    options: HttpOptions,
  ): Promise<RenderingPermissionV4> {
    try {
      const { body } = await superagent
        .get(`${options.forestServerUrl}/liana/v4/permissions/renderings/${renderingId}`)
        .set('forest-secret-key', options.envSecret);

      return body;
    } catch (e) {
      this.handleResponseError(e);
    }
  }

  private static handleResponseError(e: Error): void {
    if (/certificate/i.test(e.message))
      throw new Error(
        'ForestAdmin server TLS certificate cannot be verified. ' +
          'Please check that your system time is set properly.',
      );

    if ((e as ResponseError).response) {
      const status = (e as ResponseError)?.response?.status;

      // 0 == offline, 502 == bad gateway from proxy
      if (status === 0 || status === 502)
        throw new Error('Failed to reach ForestAdmin server. Are you online?');

      if (status === 404)
        throw new Error(
          'ForestAdmin server failed to find the project related to the envSecret you configured.' +
            ' Can you check that you copied it properly in the Forest initialization?',
        );

      if (status === 503)
        throw new Error(
          'Forest is in maintenance for a few minutes. We are upgrading your experience in ' +
            'the forest. We just need a few more minutes to get it right.',
        );

      throw new Error(
        'An unexpected error occurred while contacting the ForestAdmin server. ' +
          'Please contact support@forestadmin.com for further investigations.',
      );
    }

    throw e;
  }
}
