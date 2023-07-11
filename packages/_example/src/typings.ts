/* eslint-disable */
export type Schema = {
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
