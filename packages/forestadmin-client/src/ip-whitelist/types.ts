export type IpWhitelistConfiguration = {
  isFeatureEnabled: boolean;
  ipRules: Array<{
    type: number;
    ipMinimum?: string;
    ipMaximum?: string;
    ip?: string;
    range?: string;
  }>;
};
