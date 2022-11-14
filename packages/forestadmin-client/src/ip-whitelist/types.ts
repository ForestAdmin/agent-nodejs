export type IpWhitelistConfiguration = {
  isFeatureEnabled: boolean;
  ipRules: Array<
    | { type: 0; ip: string }
    | { type: 1; range: string }
    | { type: 2; ipMinimum: string; ipMaximum: string }
  >;
};
