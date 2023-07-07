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
      'id': number;
      'userId': number;
      'title': string;
      'body': string;
    };
    nested: {
      'user': Schema['typicode_users']['plain'] & Schema['typicode_users']['nested'];
    };
    flat: {
      'user:id': number;
    };
  };
  'typicode_users': {
    plain: {
      'id': number;
    };
    nested: {};
    flat: {};
  };
  'whatever_users': {
    plain: {
      'id': number;
      'name': string;
    };
    nested: {
      'address': Schema['whatever_users_address']['plain'] & Schema['whatever_users_address']['nested'];
    };
    flat: {
      'address:street': string;
      'address:city': string;
      'address:zipCodes': Array<number>;
      'address:_fid': string;
      'address:_fpid': number;
    };
  };
  'whatever_users_address': {
    plain: {
      'street': string;
      'city': string;
      'zipCodes': Array<number>;
      '_fid': string;
      '_fpid': number;
    };
    nested: {
      'parent': Schema['whatever_users']['plain'] & Schema['whatever_users']['nested'];
    };
    flat: {
      'parent:id': number;
      'parent:name': string;
    };
  };
};
