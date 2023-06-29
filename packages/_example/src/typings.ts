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
  'typicode_albums': {
    plain: {
      'userId': number;
      'id': number;
      'title': string;
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
    nested: {};
    flat: {};
  };
  'typicode_photos': {
    plain: {
      'albumId': number;
      'id': number;
      'title': string;
      'url': string;
      'thumbnailUrl': string;
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
  'typicode_todos': {
    plain: {
      'userId': number;
      'id': number;
      'title': string;
      'completed': boolean;
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
      'address': any;
      'phone': string;
      'website': string;
      'company': any;
    };
    nested: {};
    flat: {};
  };
};
