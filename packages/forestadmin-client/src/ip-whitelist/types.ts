export type IpWhitelistConfiguration = {
  isFeatureEnabled: boolean;
  ipRules: Array<
    | { type: 0; ip: string }
    | { type: 1; ipMinimum: string; ipMaximum: string }
    | { type: 2; range: string }
  >;
};
