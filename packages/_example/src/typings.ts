/* eslint-disable */
export type Schema = {
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
