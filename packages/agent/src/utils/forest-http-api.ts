/* eslint-disable @typescript-eslint/no-explicit-any */
import { IssuerMetadata } from 'openid-client';
import superagent, { Response, ResponseError } from 'superagent';

import { AgentOptions } from '../types';

export type UserInfo = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  team: string;
  renderingId: number;
  role: string;
  tags: { [key: string]: string };
  permissionLevel: string;
};

type HttpOptions = Pick<AgentOptions, 'envSecret' | 'forestServerUrl' | 'isProduction'>;

export default class ForestHttpApi {
  static async getOpenIdIssuerMetadata(options: HttpOptions): Promise<IssuerMetadata> {
    try {
      const response: Response = await superagent
        .get(new URL('/oidc/.well-known/openid-configuration', options.forestServerUrl).toString())
        .set('forest-secret-key', options.envSecret);

      return response.body;
    } catch (e) {
      this.handleResponseError(e);
    }
  }

  static async getUserInformation(
    options: HttpOptions,
    renderingId: number,
    accessToken: string,
  ): Promise<UserInfo> {
    try {
      const url = new URL(
        `/liana/v2/renderings/${renderingId}/authorization`,
        options.forestServerUrl,
      );

      const response = await superagent
        .get(url.toString())
        .set('forest-token', accessToken)
        .set('forest-secret-key', options.envSecret);

      const { attributes, id } = response.body.data;

      return {
        id: Number(id),
        email: attributes.email,
        firstName: attributes.first_name,
        lastName: attributes.last_name,
        team: attributes.teams[0],
        role: attributes.role,
        tags: attributes.tags?.reduce((memo, { key, value }) => ({ ...memo, [key]: value }), {}),
        renderingId,
        permissionLevel: attributes.permission_level,
      };
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
