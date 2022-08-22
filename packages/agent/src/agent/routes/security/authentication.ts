import { Client, ClientAuthMethod, Issuer } from 'openid-client';
import { ValidationError } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import jsonwebtoken from 'jsonwebtoken';
import jwt from 'koa-jwt';

import { Context } from 'koa';
import { RouteType } from '../../types';
import BaseRoute from '../base-route';
import ForestHttpApi from '../../utils/forest-http-api';

export default class Authentication extends BaseRoute {
  readonly type = RouteType.Authentication;

  private client: Client;

  override async bootstrap(): Promise<void> {
    // Retrieve OpenId Issuer from forestadmin-server
    // We can't use 'Issuer.discover' because the oidc config is behind an auth-wall.
    const issuer = new Issuer(await ForestHttpApi.getOpenIdIssuerMetadata(this.options));

    // Either instantiate or create a new oidc client.
    const registration = {
      client_id: this.options.clientId,
      token_endpoint_auth_method: 'none' as ClientAuthMethod,
    };

    this.client = registration.client_id
      ? new issuer.Client(registration)
      : await issuer.Client.register(registration, { initialAccessToken: this.options.envSecret });
  }

  setupRoutes(router: Router): void {
    router.post('/authentication', this.handleAuthentication.bind(this));
    router.get('/authentication/callback', this.handleAuthenticationCallback.bind(this));

    router.use(jwt({ secret: this.options.authSecret, cookie: 'forest_session_token' }));
  }

  public async handleAuthentication(context: Context): Promise<void> {
    const renderingId = Number(context.request.body?.renderingId);
    Authentication.checkRenderingId(renderingId);

    const authorizationUrl = this.client.authorizationUrl({
      scope: 'openid email profile',
      state: JSON.stringify({ renderingId }),
    });

    context.response.body = { authorizationUrl };
  }

  public async handleAuthenticationCallback(context: Context): Promise<void> {
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
    const user = await ForestHttpApi.getUserInformation(this.options, renderingId, accessToken);

    // Generate final token.
    const token = jsonwebtoken.sign(user, this.options.authSecret, { expiresIn: '1 hours' });

    context.response.body = {
      token,
      tokenData: jsonwebtoken.decode(token),
    };
  }

  private static checkRenderingId(renderingId: number): void {
    if (Number.isNaN(renderingId)) {
      throw new ValidationError('Rendering id must be a number');
    }
  }
}
