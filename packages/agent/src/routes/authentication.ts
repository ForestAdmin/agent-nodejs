import Router from '@koa/router';
import jsonwebtoken from 'jsonwebtoken';
import { Context } from 'koa';
import jwt from 'koa-jwt';
import { Client, ClientAuthMethod, Issuer } from 'openid-client';
import path from 'path';
import BaseRoute from './base-route';

export default class Authentication extends BaseRoute {
  private client: Client;

  private get redirectUrl(): string {
    return new URL(
      path.join(this.options.prefix, '/authentication/callback'),
      this.options.agentUrl,
    ).toString();
  }

  override async bootstrap(): Promise<void> {
    // Retrieve OpenId Issuer from forestadmin-server
    // We can't use 'Issuer.discover' because the oidc config is behind an auth-wall.
    let issuer: Issuer = null;

    try {
      const response = await this.services.forestHTTPApi.getOpenIdConfiguration();
      issuer = new Issuer(response);
    } catch {
      throw new Error('Failed to fetch openid-configuration.');
    }

    // Either instanciate or create a new oidc client.
    const registration = {
      client_id: this.options.clientId,
      token_endpoint_auth_method: 'none' as ClientAuthMethod,
      redirect_uris: [this.redirectUrl],
    };

    try {
      if (registration.client_id) {
        this.client = new issuer.Client(registration);
      } else {
        this.client = await issuer.Client.register(registration, {
          initialAccessToken: this.options.envSecret,
        });
      }
    } catch {
      throw new Error('Failed to create the openid client.');
    }
  }

  override setupAuthentication(router: Router): void {
    router.use(jwt({ secret: this.options.authSecret, cookie: 'forest_session_token' }));
  }

  override setupPublicRoutes(router: Router): void {
    router.post('/authentication', this.handleAuthentication.bind(this));
    router.get('/authentication/callback', this.handleAuthenticationCallback.bind(this));
    router.post('/authentication/logout', this.handleAuthenticationLogout.bind(this));
  }

  public async handleAuthentication(context: Context): Promise<void> {
    const renderingId = Number(context.request.body.renderingId);

    try {
      if (Number.isNaN(renderingId)) {
        throw new Error('Rendering id is invalid');
      }

      const authorizationUrl = this.client.authorizationUrl({
        scope: 'openid email profile',
        state: JSON.stringify({ renderingId }),
      });

      context.response.body = { authorizationUrl };
    } catch (error) {
      context.throw(400, 'Failed to retrieve authorization url.');
    }
  }

  public async handleAuthenticationCallback(context: Context) {
    // Retrieve tokenset
    const state = context.request.query.state.toString();
    const tokenSet = await this.client.callback(this.redirectUrl, context.request.query, {
      state,
    });

    let renderingId;

    try {
      // Load User from forestadmin-server
      // The request is in JSON API format, but we parse it manually here
      renderingId = JSON.parse(state).renderingId;
    } catch {
      context.throw(400, 'Failed to parse renderingId.');
    }

    let user;

    try {
      user = await this.services.forestHTTPApi.getUserAuthorizationInformations(
        renderingId,
        tokenSet.access_token,
      );
    } catch {
      context.throw(500, 'Failed to fetch user informations.');
    }

    try {
      // Generate final token.
      const token = jsonwebtoken.sign(user, this.options.authSecret, {
        expiresIn: '1 hours',
      });

      context.response.body = {
        token,
        tokenData: jsonwebtoken.decode(token),
      };
    } catch (error) {
      context.throw(400, 'Failed to create token with forestadmin-server.');
    }
  }

  public async handleAuthenticationLogout(context: Context) {
    context.response.status = 204;
  }
}
