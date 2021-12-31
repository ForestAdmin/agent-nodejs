import Router from '@koa/router';
import jsonwebtoken from 'jsonwebtoken';
import { Context } from 'koa';
import jwt from 'koa-jwt';
import { Client, ClientAuthMethod, Issuer } from 'openid-client';
import path from 'path';
import superagent from 'superagent';
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
      const response = await superagent
        .get(new URL('/oidc/.well-known/openid-configuration', this.options.forestServerUrl))
        .set('forest-secret-key', this.options.envSecret);
      issuer = new Issuer(response.body);
    } catch (error) {
      throw new Error('Failed to fetch openid-configuration');
    }

    // Either instanciate or create a new oidc client.
    const registration = {
      client_id: this.options.clientId,
      token_endpoint_auth_method: 'none' as ClientAuthMethod,
      redirect_uris: [this.redirectUrl],
    };

    if (registration.client_id) {
      this.client = new issuer.Client(registration);
    } else {
      // This is due to an issue with the types provided by openid-client
      // Casting to any then calling register works as expected
      const { register } = issuer.Client as any;

      this.client = await register.call(issuer.Client, registration, {
        initialAccessToken: this.options.envSecret,
      });
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

    // Load User from forestadmin-server
    // The request is in JSON API format, but we parse it manually here
    const { renderingId } = JSON.parse(state);

    try {
      const response = await superagent
        .get(
          new URL(
            `/liana/v2/renderings/${renderingId}/authorization`,
            this.options.forestServerUrl,
          ),
        )
        .set('forest-token', tokenSet.access_token)
        .set('forest-secret-key', this.options.envSecret);

      const user = { ...response.body.data.attributes, id: response.body.data.id };

      // Generate final token.
      const token = jsonwebtoken.sign(
        {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          team: user.teams[0],
          renderingId,
        },
        this.options.authSecret,
        { expiresIn: '1 hours' },
      );

      context.response.body = {
        token,
        tokenData: jsonwebtoken.decode(token),
      };
    } catch (error) {
      context.throw(400, 'Failed to exchange token with forestadmin-server.');
    }
  }

  public async handleAuthenticationLogout(context: Context) {
    context.response.status = 204;
  }
}
