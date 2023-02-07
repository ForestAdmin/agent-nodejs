/* eslint-disable */
export type Schema = {
  'account': {
    plain: {
      'firstname': string;
      'lastname': string;
      'storeId': number;
      '_id': string;
    };
    nested: {
      'address': Schema['account_address']['plain'] & Schema['account_address']['nested'];
      'store': Schema['store']['plain'] & Schema['store']['nested'];
    };
    flat: {
      'address:streetNumber': number;
      'address:streetName': string;
      'address:city': string;
      'address:country': string;
      'address:_id': string;
      'address:parentId': string;
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
  'account_address': {
    plain: {
      'streetNumber': number;
      'streetName': string;
      'city': string;
      'country': string;
      '_id': string;
      'parentId': string;
    };
    nested: {
      'parent': Schema['account']['plain'] & Schema['account']['nested'];
    };
    flat: {
      'parent:firstname': string;
      'parent:lastname': string;
      'parent:storeId': number;
      'parent:_id': string;
      'parent:store:id': number;
      'parent:store:name': string;
      'parent:store:ownerId': number;
      'parent:store:ownerFullName': string;
      'parent:store:owner:id': number;
      'parent:store:owner:firstName': string;
      'parent:store:owner:lastName': string;
      'parent:store:owner:fullName': string;
    };
  };
  'account_bills': {
    plain: {
      'title': string;
      'amount': number;
      'issueDate': string;
      '_id': string;
      'parentId': string;
    };
    nested: {
      'parent': Schema['account']['plain'] & Schema['account']['nested'];
    };
    flat: {
      'parent:firstname': string;
      'parent:lastname': string;
      'parent:storeId': number;
      'parent:_id': string;
      'parent:address:streetNumber': number;
      'parent:address:streetName': string;
      'parent:address:city': string;
      'parent:address:country': string;
      'parent:address:_id': string;
      'parent:address:parentId': string;
      'parent:store:id': number;
      'parent:store:name': string;
      'parent:store:ownerId': number;
      'parent:store:ownerFullName': string;
      'parent:store:owner:id': number;
      'parent:store:owner:firstName': string;
      'parent:store:owner:lastName': string;
      'parent:store:owner:fullName': string;
    };
  };
  'account_bills_items': {
    plain: {
      'importance': 'high' | 'medium' | 'low';
      'title': string;
      'amount': number;
      '_id': string;
      'parentId': string;
    };
    nested: {
      'parent': Schema['account_bills']['plain'] & Schema['account_bills']['nested'];
    };
    flat: {
      'parent:title': string;
      'parent:amount': number;
      'parent:issueDate': string;
      'parent:_id': string;
      'parent:parentId': string;
      'parent:parent:firstname': string;
      'parent:parent:lastname': string;
      'parent:parent:storeId': number;
      'parent:parent:_id': string;
      'parent:parent:address:streetNumber': number;
      'parent:parent:address:streetName': string;
      'parent:parent:address:city': string;
      'parent:parent:address:country': string;
      'parent:parent:address:_id': string;
      'parent:parent:address:parentId': string;
      'parent:parent:store:id': number;
      'parent:parent:store:name': string;
      'parent:parent:store:ownerId': number;
      'parent:parent:store:ownerFullName': string;
      'parent:parent:store:owner:id': number;
      'parent:parent:store:owner:firstName': string;
      'parent:parent:store:owner:lastName': string;
      'parent:parent:store:owner:fullName': string;
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
  'dev_xp_members': {
    plain: {
      'id': number;
      'name': string;
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
