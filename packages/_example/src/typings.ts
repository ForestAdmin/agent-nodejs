/* eslint-disable */
export type Schema = {
  'forest_sync_state': {
    plain: {
      'id': string;
      'state': string;
      'createdAt': string;
      'updatedAt': string;
    };
    nested: {};
    flat: {};
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
};
