import type { IpWhitelistConfiguration } from '@forestadmin/forestadmin-client';
import type Router from '@koa/router';
import type { Context, Next } from 'koa';

import { BlockList, isIPv6 } from 'net';

import { HttpCode, RouteType } from '../../types';
import BaseRoute from '../base-route';

type IpRule = IpWhitelistConfiguration['ipRules'][number];

const LOOPBACK_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

const ipVersion = (ip: string): 'ipv4' | 'ipv6' => (isIPv6(ip) ? 'ipv6' : 'ipv4');

export default class IpWhitelist extends BaseRoute {
  type = RouteType.Authentication;

  private configuration: IpWhitelistConfiguration;

  private allowedIps: BlockList;

  setupRoutes(router: Router): void {
    router.use(this.checkIp.bind(this));
  }

  /** Load whitelist */
  override async bootstrap(): Promise<void> {
    this.configuration = await this.options.forestAdminClient.getIpWhitelistConfiguration();
    this.allowedIps = new BlockList();

    this.configuration.ipRules.forEach(rule => {
      try {
        IpWhitelist.allowRule(this.allowedIps, rule);
      } catch (error) {
        this.options.logger('Warn', `IP whitelist: ignoring invalid rule ${JSON.stringify(rule)}`);
      }
    });
  }

  private static allowRule(allowedIps: BlockList, rule: IpRule): void {
    if (rule.type === 0) {
      allowedIps.addAddress(rule.ip, ipVersion(rule.ip));
    } else if (rule.type === 1) {
      allowedIps.addRange(rule.ipMinimum, rule.ipMaximum, ipVersion(rule.ipMinimum));
    } else {
      const [ip, prefix] = rule.range.split('/');

      allowedIps.addSubnet(ip, Number(prefix), ipVersion(ip));
    }
  }

  async checkIp(context: Context, next: Next): Promise<boolean> {
    if (this.configuration.isFeatureEnabled) {
      if (this.isTrustedInternalCaller(context)) {
        this.options.logger('Debug', 'IP whitelist: exempting trusted internal caller');

        return next();
      }

      const currentIp = `${context.request.headers['x-forwarded-for'] ?? context.request.ip}`;

      if (!this.allowedIps.check(currentIp, ipVersion(currentIp))) {
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
