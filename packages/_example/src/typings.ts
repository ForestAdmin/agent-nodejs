/* eslint-disable */
export type Schema = {
  'hubspot_companies': {
    plain: {
      'id': string;
      'city': string;
      'name': string;
      'country': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_companies_contacts': {
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
      'companies:name': string;
      'companies:country': string;
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
    };
  };
  'hubspot_companies_deals': {
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
      'companies:name': string;
      'companies:country': string;
      'deals:id': string;
      'deals:description': string;
    };
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'email': string;
      'firstname': string;
      'lastname': string;
    };
    nested: {};
    flat: {};
  };
  'hubspot_contacts_deals': {
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
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'deals:id': string;
      'deals:description': string;
    };
  };
  'hubspot_deals': {
    plain: {
      'id': string;
      'description': string;
    };
    nested: {};
    flat: {};
  };
};
