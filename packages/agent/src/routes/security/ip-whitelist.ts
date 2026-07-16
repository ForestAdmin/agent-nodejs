import type { IpWhitelistConfiguration } from '@forestadmin/forestadmin-client';
import type Router from '@koa/router';
import type { Context, Next } from 'koa';

import IpUtil from 'forest-ip-utils';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

const LOOPBACK_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export default class IpWhitelist extends BaseRoute {
  type = RouteType.Authentication;

  private configuration: IpWhitelistConfiguration;

  setupRoutes(router: Router): void {
    router.use(this.checkIp.bind(this));
  }

  /** Load whitelist */
  override async bootstrap(): Promise<void> {
    this.configuration = await this.options.forestAdminClient.getIpWhitelistConfiguration();
  }

  async checkIp(context: Context, next: Next): Promise<boolean> {
    if (this.configuration.isFeatureEnabled) {
      if (this.isTrustedInternalCaller(context)) {
        this.options.logger('Debug', 'IP whitelist: exempting trusted internal caller');

        return next();
      }

      const { ipRules } = this.configuration;
      const currentIp = context.request.headers['x-forwarded-for'] ?? context.request.ip;
      const allowed = ipRules.some(ipRule => IpUtil.isIpMatchesRule(currentIp, ipRule));

      if (!allowed) {
        return context.throw(HttpCode.Forbidden, `IP address rejected (${currentIp})`);
      }
    }

    return next();
  }

  // A caller reaching us directly over a loopback socket with no proxy hop (no x-forwarded-for) is
  // on this host and already JWT-authenticated (koa-jwt runs before this) — e.g. the embedded
  // executor's loopback call. Keys off the socket peer (req.socket.remoteAddress), never
  // request.ip / x-forwarded-for, which follow the spoofable header once the host app sets app.proxy.
  private isTrustedInternalCaller(context: Context): boolean {
    const socketIp = context.req?.socket?.remoteAddress ?? '';

    return LOOPBACK_IPS.includes(socketIp) && !context.request.headers['x-forwarded-for'];
  }
}
