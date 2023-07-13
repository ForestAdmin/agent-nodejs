/* eslint-disable */
export type Schema = {
  'hubspot_companies': {
    plain: {
      'id': string;
      'description': string;
      'days_to_close': number;
      'city': string;
      'owneremail': string;
      'state': string;
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
      'contacts:country': string;
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
  'hubspot_line_items': {
    plain: {
      'id': string;
      'amount': number;
    };
    nested: {};
    flat: {};
  };
  'typicode_posts': {
    plain: {
      'userId': number;
      'id': number;
      'title': string;
      'body': string;
    };
    nested: {};
    flat: {};
  };
  'typicode_users': {
    plain: {
      'id': number;
      'name': string;
      'username': string;
      'email': string;
      'address': {street: string; suite: string; city: string; zipcode: string; geo: {lat: string; lng: string}};
      'phone': string;
      'website': string;
      'company': {name: string; catchPhrase: string; bs: string};
    };
    nested: {};
    flat: {};
  };
  'whatever_users': {
    plain: {
      'id': number;
      'name': string;
      'address@@@city': string;
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
      'parent:address@@@city': string;
      'parent:address@@@street': string;
    };
  };
};
