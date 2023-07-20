/* eslint-disable */
export type Schema = {
  'hubspot_companies': {
    plain: {
      'id': string;
      'city': string;
      'domain': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_companies___contacts': {
    plain: {
      'companies_id': string;
      'contacts_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:domain': string;
      'contacts:id': string;
      'contacts:firstname': string;
    };
  };
  'hubspot_companies___deals': {
    plain: {
      'companies_id': string;
      'deals_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:domain': string;
      'deals:id': string;
      'deals:dealname': string;
    };
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'firstname': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_contacts___deals': {
    plain: {
      'contacts_id': string;
      'deals_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:firstname': string;
      'deals:id': string;
      'deals:dealname': string;
    };
  };
  'hubspot_deals': {
    plain: {
      'id': string;
      'dealname': string;
    };
    nested: {};
    flat: {};
  };
};
