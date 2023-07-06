/* eslint-disable */
export type Schema = {
  'users': {
    plain: {
      'id': number;
      'name': string;
    };
    nested: {
      'address': Schema['users_address']['plain'] & Schema['users_address']['nested'];
    };
    flat: {
      'address:street': string;
      'address:city': string;
      'address:zipCodes': Array<number>;
      'address:_fid': string;
      'address:_fpid': number;
    };
  };
  'users_address': {
    plain: {
      'street': string;
      'city': string;
      'zipCodes': Array<number>;
      '_fid': string;
      '_fpid': number;
    };
    nested: {
      'parent': Schema['users']['plain'] & Schema['users']['nested'];
    };
    flat: {
      'parent:id': number;
      'parent:name': string;
    };
  };
};
