/* eslint-disable */
export type Schema = {
  'account': {
    plain: {
      'firstname': string;
      'lastname': string;
      'storeId': number;
      'address': {streetNumber: number; streetName: string; city: string; country: string; sub: {importance: string; title: string; amount: number}};
      'bills': Array<{title: string; amount: number; issueDate: string; items: Array<{importance: string; title: string; amount: number}>}>;
      '_id': string;
      'address@@@streetNumber': number;
      'address@@@streetName': string;
      'address@@@city': string;
      'address@@@country': string;
      'address@@@sub@@@importance': string;
      'address@@@sub@@@title': string;
      'address@@@sub@@@amount': number;
    };
    nested: {
      'store': Schema['store']['plain'] & Schema['store']['nested'];
    };
    flat: {
      'store:id': number;
      'store:name': string;
      'store:ownerId': number;
      'store:ownerFullName': string;
      'store:owner:id': number;
      'store:owner:firstName': string;
      'store:owner:lastName': string;
      'store:owner:fullName': string;
    };
  };
  'card': {
    plain: {
      'id': number;
      'card_number': number;
      'card_type': 'visa' | 'mastercard' | 'american express';
      'is_active': boolean;
      'customer_id': number;
    };
    nested: {
      'customer': Schema['customer']['plain'] & Schema['customer']['nested'];
    };
    flat: {
      'customer:id': number;
      'customer:name': string;
      'customer:firstName': string;
      'customer:createdAt': string;
      'customer:updatedAt': string;
      'customer:deletedAt': string;
    };
  };
  'comment': {
    plain: {
      'id': number;
      'postId': number;
      'name': string;
      'email': string;
      'body': string;
    };
    nested: {
      'post': Schema['post']['plain'] & Schema['post']['nested'];
    };
    flat: {
      'post:id': number;
      'post:userId': number;
      'post:title': string;
      'post:body': string;
      'post:owner:id': number;
      'post:owner:firstName': string;
      'post:owner:lastName': string;
      'post:owner:fullName': string;
    };
  };
  'customer': {
    plain: {
      'id': number;
      'name': string;
      'firstName': string;
      'createdAt': string;
      'updatedAt': string;
      'deletedAt': string;
    };
    nested: {};
    flat: {};
  };
  'dvd': {
    plain: {
      'id': number;
      'title': string;
      'rentalPrice': number;
      'storeId': number;
      'numberOfRentals': number;
    };
    nested: {
      'store': Schema['store']['plain'] & Schema['store']['nested'];
    };
    flat: {
      'store:id': number;
      'store:name': string;
      'store:ownerId': number;
      'store:ownerFullName': string;
      'store:owner:id': number;
      'store:owner:firstName': string;
      'store:owner:lastName': string;
      'store:owner:fullName': string;
    };
  };
  'dvd_rental': {
    plain: {
      'dvdId': number;
      'rentalId': number;
    };
    nested: {
      'dvd': Schema['dvd']['plain'] & Schema['dvd']['nested'];
      'rental': Schema['rental']['plain'] & Schema['rental']['nested'];
    };
    flat: {
      'dvd:id': number;
      'dvd:title': string;
      'dvd:rentalPrice': number;
      'dvd:storeId': number;
      'dvd:numberOfRentals': number;
      'dvd:store:id': number;
      'dvd:store:name': string;
      'dvd:store:ownerId': number;
      'dvd:store:ownerFullName': string;
      'dvd:store:owner:id': number;
      'dvd:store:owner:firstName': string;
      'dvd:store:owner:lastName': string;
      'dvd:store:owner:fullName': string;
      'rental:id': number;
      'rental:startDate': string;
      'rental:endDate': string;
      'rental:customerId': number;
      'rental:numberOfDays': number;
      'rental:customer:id': number;
      'rental:customer:name': string;
      'rental:customer:firstName': string;
      'rental:customer:createdAt': string;
      'rental:customer:updatedAt': string;
      'rental:customer:deletedAt': string;
    };
  };
  'owner': {
    plain: {
      'id': number;
      'firstName': string;
      'lastName': string;
      'fullName': string;
    };
    nested: {};
    flat: {};
  };
  'post': {
    plain: {
      'id': number;
      'userId': number;
      'title': string;
      'body': string;
    };
    nested: {
      'owner': Schema['owner']['plain'] & Schema['owner']['nested'];
    };
    flat: {
      'owner:id': number;
      'owner:firstName': string;
      'owner:lastName': string;
      'owner:fullName': string;
    };
  };
  'rental': {
    plain: {
      'id': number;
      'startDate': string;
      'endDate': string;
      'customerId': number;
      'numberOfDays': number;
    };
    nested: {
      'customer': Schema['customer']['plain'] & Schema['customer']['nested'];
    };
    flat: {
      'customer:id': number;
      'customer:name': string;
      'customer:firstName': string;
      'customer:createdAt': string;
      'customer:updatedAt': string;
      'customer:deletedAt': string;
    };
  };
  'review': {
    plain: {
      'id': number;
      'title': string;
      'message': string;
      'storeId': number;
    };
    nested: {
      'store': Schema['store']['plain'] & Schema['store']['nested'];
    };
    flat: {
      'store:id': number;
      'store:name': string;
      'store:ownerId': number;
      'store:ownerFullName': string;
      'store:owner:id': number;
      'store:owner:firstName': string;
      'store:owner:lastName': string;
      'store:owner:fullName': string;
    };
  };
  'store': {
    plain: {
      'id': number;
      'name': string;
      'ownerId': number;
      'ownerFullName': string;
    };
    nested: {
      'owner': Schema['owner']['plain'] & Schema['owner']['nested'];
    };
    flat: {
      'owner:id': number;
      'owner:firstName': string;
      'owner:lastName': string;
      'owner:fullName': string;
    };
  };
};
