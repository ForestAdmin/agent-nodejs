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
  'typicode_comments': {
    plain: {
      'postId': number;
      'id': number;
      'name': string;
      'email': string;
      'body': string;
    };
    nested: {
      'post': Schema['typicode_posts']['plain'] & Schema['typicode_posts']['nested'];
    };
    flat: {
      'post:userId': number;
      'post:id': number;
      'post:title': string;
      'post:body': string;
    };
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
};
