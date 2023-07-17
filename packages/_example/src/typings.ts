/* eslint-disable */
export type Schema = {
  'albums': {
    plain: {
      'userId': number;
      'id': number;
      'title': string;
    };
    nested: {};
    flat: {};
  };
  'comments': {
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
  'photos': {
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
  'posts': {
    plain: {
      'userId': number;
      'id': number;
      'title': string;
      'body': string;
    };
    nested: {};
    flat: {};
  };
  'users': {
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
};
