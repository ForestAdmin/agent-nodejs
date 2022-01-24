import Router from '@koa/router';
import IpUtil from 'forest-ip-utils';
import { Context, Next } from 'koa';
import BaseRoute from '../base-route';
import { HttpCode } from '../../types';
import { IpRule } from '../../services/forest-http-api';

export default class IpWhitelist extends BaseRoute {
  private isFeatureEnabled: boolean;
  private ipRules: Array<IpRule>;

  override setupAuthentication(router: Router): void {
    router.use(this.checkIp.bind(this));
  }

  /** Load whitelist */
  override async bootstrap(): Promise<void> {
    const { isFeatureEnabled, ipRules } = await this.services.forestHTTPApi.getIpWhitelist();

    this.isFeatureEnabled = isFeatureEnabled;

    if (this.isFeatureEnabled) {
      this.ipRules = ipRules;
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
