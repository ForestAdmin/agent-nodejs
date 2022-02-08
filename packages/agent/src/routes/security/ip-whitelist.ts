import Router from '@koa/router';
import IpUtil from 'forest-ip-utils';
import { Context, Next } from 'koa';
import BaseRoute from '../base-route';
import { HttpCode } from '../../types';
import ForestHttpApi, { IpWhitelistConfiguration } from '../../utils/forest-http-api';

export default class IpWhitelist extends BaseRoute {
  private isFeatureEnabled: boolean;
  private ipRules: IpWhitelistConfiguration['ipRules'];

  override setupAuthentication(router: Router): void {
    router.use(this.checkIp.bind(this));
  }

  /** Load whitelist */
  override async bootstrap(): Promise<void> {
    const configuration = await ForestHttpApi.getIpWhitelistConfiguration(this.options);

    this.isFeatureEnabled = configuration.isFeatureEnabled;

    if (this.isFeatureEnabled) {
      this.ipRules = configuration.ipRules;
    }
  }

  async checkIp(context: Context, next: Next): Promise<boolean> {
    if (this.isFeatureEnabled) {
      const currentIp = context.request.headers['x-forwarded-for'] ?? context.request.ip;

      const allowed = this.ipRules.some(ipRule => IpUtil.isIpMatchesRule(currentIp, ipRule));

      if (!allowed) {
        return context.throw(HttpCode.Forbidden, `IP address rejected (${currentIp})`);
      }
    }

    return next();
  }
}
