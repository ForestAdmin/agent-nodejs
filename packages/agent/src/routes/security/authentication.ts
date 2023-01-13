import type { Client } from 'openid-client';

import { ValidationError } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import jsonwebtoken from 'jsonwebtoken';
import { Context } from 'koa';
import jwt from 'koa-jwt';

import { RouteType } from '../../types';
import BaseRoute from '../base-route';

export default class Authentication extends BaseRoute {
  readonly type = RouteType.Authentication;

  private client: Client;

  override async bootstrap(): Promise<void> {
    this.client = await this.options.forestAdminClient.getOpenIdClient();
  }

  setupRoutes(router: Router): void {
    router.post('/authentication', this.handleAuthentication.bind(this));
    router.get('/authentication/callback', this.handleAuthenticationCallback.bind(this));

    router.use(jwt({ secret: this.options.authSecret, cookie: 'forest_session_token' }));
  }

  private async handleAuthentication(context: Context): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const renderingId = Number(body?.renderingId);
    Authentication.checkRenderingId(renderingId);

    const authorizationUrl = this.client.authorizationUrl({
      scope: 'openid email profile',
      state: JSON.stringify({ renderingId }),
    });

    context.response.body = { authorizationUrl };
  }

  private async handleAuthenticationCallback(context: Context): Promise<void> {
    // Retrieve renderingId
    const { query } = context.request;
    const state = query.state.toString();
    let renderingId: number;

    try {
      renderingId = JSON.parse(state).renderingId;
      Authentication.checkRenderingId(renderingId);
    } catch {
      throw new ValidationError('Failed to retrieve renderingId from query[state]');
    }

    // Retrieve user
    const tokenSet = await this.client.callback(undefined, query, { state });
    const accessToken = tokenSet.access_token;
    const user = await this.options.forestAdminClient.getUserInfo(renderingId, accessToken);

    // Generate final token.
    const token = jsonwebtoken.sign(user, this.options.authSecret, { expiresIn: '1 hours' });

    context.response.body = { token, tokenData: jsonwebtoken.decode(token) };
  }

  private static checkRenderingId(renderingId: number): void {
    if (Number.isNaN(renderingId)) {
      throw new ValidationError('Rendering id must be a number');
    }
  }
}
