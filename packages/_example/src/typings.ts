/* eslint-disable */
export type Schema = {
<<<<<<< HEAD
  'hubspot_companies': {
    plain: {
      'id': string;
      'description': string;
      'days_to_close': number;
      'city': string;
      'owneremail': string;
      'state': string;
=======
  'country': {
    plain: {
      'country_iso3': string;
      'country_name': string;
      'currency_code': string;
    };
    nested: {
      'currency': Schema['currency']['plain'] & Schema['currency']['nested'];
    };
    flat: {
      'currency:code': string;
      'currency:name': string;
    };
  };
  'currency': {
    plain: {
      'code': string;
      'name': string;
>>>>>>> @{-1}
    };
    nested: {};
    flat: {};
  };
<<<<<<< HEAD
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
      'companies:description': string;
      'companies:days_to_close': number;
      'companies:city': string;
      'companies:owneremail': string;
      'companies:state': string;
      'contacts:id': string;
      'contacts:country': string;
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
      'companies:description': string;
      'companies:days_to_close': number;
      'companies:city': string;
      'companies:owneremail': string;
      'companies:state': string;
      'deals:id': string;
      'deals:description': string;
=======
  'exchange_rate': {
    plain: {
      'date': string;
      'currency_code': string;
      'rate': number;
    };
    nested: {
      'currency': Schema['currency']['plain'] & Schema['currency']['nested'];
    };
    flat: {
      'currency:code': string;
      'currency:name': string;
>>>>>>> @{-1}
    };
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'country': string;
    };
    nested: {};
    flat: {};
  };
<<<<<<< HEAD
  'hubspot_contacts_deals': {
    plain: {
      'contacts_id': string;
      'deals_id': string;
=======
  'whatever_users': {
    plain: {
      'id': number;
      'name': string;
      'address@@@street': string;
    };
    nested: {};
    flat: {};
  };
  'whatever_users_address_zipCodes': {
    plain: {
      'value': number;
      '_fid': string;
      '_fpid': number;
>>>>>>> @{-1}
    };
    nested: {
      'contacts': Schema['hubspot_contacts']['plain'] & Schema['hubspot_contacts']['nested'];
      'deals': Schema['hubspot_deals']['plain'] & Schema['hubspot_deals']['nested'];
    };
    flat: {
<<<<<<< HEAD
      'contacts:id': string;
      'contacts:country': string;
      'deals:id': string;
      'deals:description': string;
=======
      'parent:id': number;
      'parent:name': string;
      'parent:address@@@street': string;
>>>>>>> @{-1}
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
  'hubspot_flos': {
    plain: {
      'id': string;
      'age': number;
    };
    nested: {};
    flat: {};
  };
  'hubspot_line_items': {
    plain: {
      'id': string;
      'amount': number;
    };
    nested: {};
    flat: {};
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
