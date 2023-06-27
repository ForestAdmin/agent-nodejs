/* eslint-disable */
export type Schema = {
  'typicode_comments': {
    plain: {
      'postId': number;
      'id': number;
      'name': string;
      'email': string;
      'body': string;
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
};
