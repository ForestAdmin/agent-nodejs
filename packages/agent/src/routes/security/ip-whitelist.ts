import { Context, Next } from 'koa';
import IpUtil from 'forest-ip-utils';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import BaseRoute from '../base-route';
import ForestHttpApi, { IpWhitelistConfiguration } from '../../utils/forest-http-api';

export default class IpWhitelist extends BaseRoute {
  private configuration: IpWhitelistConfiguration;

  override setupAuthentication(router: Router): void {
    router.use(this.checkIp.bind(this));
  }

  /** Load whitelist */
  override async bootstrap(): Promise<void> {
    this.configuration = await ForestHttpApi.getIpWhitelistConfiguration(this.options);
  }

  async checkIp(context: Context, next: Next): Promise<boolean> {
    if (this.configuration.isFeatureEnabled) {
      const { ipRules } = this.configuration;
      const currentIp = context.request.headers['x-forwarded-for'] ?? context.request.ip;
      const allowed = ipRules.some(ipRule => IpUtil.isIpMatchesRule(currentIp, ipRule));

      if (!allowed) {
        return context.throw(HttpCode.Forbidden, `IP address rejected (${currentIp})`);
      }
    }

    return next();
  }
}
