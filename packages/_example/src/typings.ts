/* eslint-disable */
export type Schema = {
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
    };
    nested: {};
    flat: {};
  };
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
    };
  };
  'hubspot_contacts': {
    plain: {
      'id': string;
      'firstname': string;
      'lastname': string;
      'mycustomfield': string;
    };
    nested: {};
    flat: {};
  };
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
    };
    nested: {
      'parent': Schema['whatever_users']['plain'] & Schema['whatever_users']['nested'];
    };
    flat: {
      'parent:id': number;
      'parent:name': string;
      'parent:address@@@street': string;
    };
  };
};
