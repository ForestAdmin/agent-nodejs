/* eslint-disable */
export type Schema = {
  'account': {
    plain: {
      'firstname': string;
      'lastname': string;
      'storeId': number;
      'avatar': Buffer;
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
      'parent:avatar': Buffer;
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
      'parent:avatar': Buffer;
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
      'parent:parent:avatar': Buffer;
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
      'rentalDvd': Schema['dvd_rental']['plain'] & Schema['dvd_rental']['nested'];
      'store': Schema['store']['plain'] & Schema['store']['nested'];
    };
    flat: {
      'rentalDvd:rentalId': number;
      'rentalDvd:dvdId': number;
      'rentalDvd:rental:id': number;
      'rentalDvd:rental:startDate': string;
      'rentalDvd:rental:endDate': string;
      'rentalDvd:rental:customerId': number;
      'rentalDvd:rental:numberOfDays': number;
      'rentalDvd:rental:customer:id': number;
      'rentalDvd:rental:customer:name': string;
      'rentalDvd:rental:customer:firstName': string;
      'rentalDvd:rental:customer:createdAt': string;
      'rentalDvd:rental:customer:updatedAt': string;
      'rentalDvd:rental:customer:deletedAt': string;
      'rentalDvd:dvd:id': number;
      'rentalDvd:dvd:title': string;
      'rentalDvd:dvd:rentalPrice': number;
      'rentalDvd:dvd:storeId': number;
      'rentalDvd:dvd:numberOfRentals': number;
      'rentalDvd:dvd:store:id': number;
      'rentalDvd:dvd:store:name': string;
      'rentalDvd:dvd:store:ownerId': number;
      'rentalDvd:dvd:store:ownerFullName': string;
      'rentalDvd:dvd:store:owner:id': number;
      'rentalDvd:dvd:store:owner:firstName': string;
      'rentalDvd:dvd:store:owner:lastName': string;
      'rentalDvd:dvd:store:owner:fullName': string;
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
      'rentalId': number;
      'dvdId': number;
    };
    nested: {
      'rental': Schema['rental']['plain'] & Schema['rental']['nested'];
      'dvd': Schema['dvd']['plain'] & Schema['dvd']['nested'];
    };
    flat: {
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
      'dvdRental': Schema['dvd_rental']['plain'] & Schema['dvd_rental']['nested'];
      'customer': Schema['customer']['plain'] & Schema['customer']['nested'];
    };
    flat: {
      'dvdRental:rentalId': number;
      'dvdRental:dvdId': number;
      'dvdRental:rental:id': number;
      'dvdRental:rental:startDate': string;
      'dvdRental:rental:endDate': string;
      'dvdRental:rental:customerId': number;
      'dvdRental:rental:numberOfDays': number;
      'dvdRental:rental:customer:id': number;
      'dvdRental:rental:customer:name': string;
      'dvdRental:rental:customer:firstName': string;
      'dvdRental:rental:customer:createdAt': string;
      'dvdRental:rental:customer:updatedAt': string;
      'dvdRental:rental:customer:deletedAt': string;
      'dvdRental:dvd:id': number;
      'dvdRental:dvd:title': string;
      'dvdRental:dvd:rentalPrice': number;
      'dvdRental:dvd:storeId': number;
      'dvdRental:dvd:numberOfRentals': number;
      'dvdRental:dvd:store:id': number;
      'dvdRental:dvd:store:name': string;
      'dvdRental:dvd:store:ownerId': number;
      'dvdRental:dvd:store:ownerFullName': string;
      'dvdRental:dvd:store:owner:id': number;
      'dvdRental:dvd:store:owner:firstName': string;
      'dvdRental:dvd:store:owner:lastName': string;
      'dvdRental:dvd:store:owner:fullName': string;
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
