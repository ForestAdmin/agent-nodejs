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
  'hubspot_companies_flos': {
    plain: {
      'companies_id': string;
      'flos_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'flos': Schema['hubspot_flos']['plain'] & Schema['hubspot_flos']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'flos:id': string;
      'flos:age': number;
    };
  };
  'hubspot_companies_testalbans': {
    plain: {
      'companies_id': string;
      'testalbans_id': string;
    };
    nested: {
      'companies': Schema['hubspot_companies']['plain'] & Schema['hubspot_companies']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'companies:id': string;
      'companies:city': string;
      'companies:name': string;
      'companies:country': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
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
  'hubspot_contacts_flos': {
    plain: {
      'contacts_id': string;
      'flos_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'flos': Schema['hubspot_flos']['plain'] & Schema['hubspot_flos']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'flos:id': string;
      'flos:age': number;
    };
  };
  'hubspot_contacts_testalbans': {
    plain: {
      'contacts_id': string;
      'testalbans_id': string;
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'contacts:id': string;
      'contacts:email': string;
      'contacts:firstname': string;
      'contacts:lastname': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
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
  'hubspot_deals_flos': {
    plain: {
      'deals_id': string;
      'flos_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'flos': Schema['hubspot_flos']['plain'] & Schema['hubspot_flos']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'flos:id': string;
      'flos:age': number;
    };
  };
  'hubspot_deals_testalbans': {
    plain: {
      'deals_id': string;
      'testalbans_id': string;
    };
    nested: {
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'deals:id': string;
      'deals:description': string;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_flos': {
    plain: {
      'id': string;
      'age': number;
    };
    nested: {};
    flat: {};
  };
  'hubspot_flos_testalbans': {
    plain: {
      'flos_id': string;
      'testalbans_id': string;
    };
    nested: {
      'flos': Schema['hubspot_flos']['plain'] & Schema['hubspot_flos']['nested'];
      'testalbans': Schema['hubspot_testalbans']['plain'] & Schema['hubspot_testalbans']['nested'];
    };
    flat: {
      'flos:id': string;
      'flos:age': number;
      'testalbans:id': string;
      'testalbans:mon_object_perso': string;
    };
  };
  'hubspot_testalbans': {
    plain: {
      'id': string;
      'mon_object_perso': string;
    };
    nested: {};
    flat: {};
  };
};
