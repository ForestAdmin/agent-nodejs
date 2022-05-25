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
      'address:_pid': string;
      'store:id': number;
      'store:name': string;
      'store:ownerId': number;
      'store:ownerFullName': string;
      'store:owner:id': number;
      'store:owner:firstName': string;
      'store:owner:lastName': string;
      'store:owner:fullName': string;
      'store:address:id': number;
      'store:address:zipCode': string;
      'store:address:address': string;
      'store:address:storeId': number;
      'store:address:createdAt': string;
      'store:address:updatedAt': string;
      'store:address:nearStates': Array<{code: number; name: string}>;
    };
  };
  'account_address': {
    plain: {
      'streetNumber': number;
      'streetName': string;
      'city': string;
      'country': string;
      '_id': string;
      '_pid': string;
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
      'parent:store:address:id': number;
      'parent:store:address:zipCode': string;
      'parent:store:address:address': string;
      'parent:store:address:storeId': number;
      'parent:store:address:createdAt': string;
      'parent:store:address:updatedAt': string;
      'parent:store:address:nearStates': Array<{code: number; name: string}>;
    };
  };
  'account_bills': {
    plain: {
      'title': string;
      'amount': number;
      'issueDate': string;
      '_id': string;
      '_pid': string;
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
      'parent:address:_pid': string;
      'parent:store:id': number;
      'parent:store:name': string;
      'parent:store:ownerId': number;
      'parent:store:ownerFullName': string;
      'parent:store:owner:id': number;
      'parent:store:owner:firstName': string;
      'parent:store:owner:lastName': string;
      'parent:store:owner:fullName': string;
      'parent:store:address:id': number;
      'parent:store:address:zipCode': string;
      'parent:store:address:address': string;
      'parent:store:address:storeId': number;
      'parent:store:address:createdAt': string;
      'parent:store:address:updatedAt': string;
      'parent:store:address:nearStates': Array<{code: number; name: string}>;
    };
  };
  'account_bills_items': {
    plain: {
      'importance': 'high' | 'medium' | 'low';
      'title': string;
      'amount': number;
      '_id': string;
      '_pid': string;
    };
    nested: {
      'parent': Schema['account_bills']['plain'] & Schema['account_bills']['nested'];
    };
    flat: {
      'parent:title': string;
      'parent:amount': number;
      'parent:issueDate': string;
      'parent:_id': string;
      'parent:_pid': string;
      'parent:parent:firstname': string;
      'parent:parent:lastname': string;
      'parent:parent:storeId': number;
      'parent:parent:_id': string;
      'parent:parent:address:streetNumber': number;
      'parent:parent:address:streetName': string;
      'parent:parent:address:city': string;
      'parent:parent:address:country': string;
      'parent:parent:address:_id': string;
      'parent:parent:address:_pid': string;
      'parent:parent:store:id': number;
      'parent:parent:store:name': string;
      'parent:parent:store:ownerId': number;
      'parent:parent:store:ownerFullName': string;
      'parent:parent:store:owner:id': number;
      'parent:parent:store:owner:firstName': string;
      'parent:parent:store:owner:lastName': string;
      'parent:parent:store:owner:fullName': string;
      'parent:parent:store:address:id': number;
      'parent:parent:store:address:zipCode': string;
      'parent:parent:store:address:address': string;
      'parent:parent:store:address:storeId': number;
      'parent:parent:store:address:createdAt': string;
      'parent:parent:store:address:updatedAt': string;
      'parent:parent:store:address:nearStates': Array<{code: number; name: string}>;
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
      'createdAt': string;
      'updatedAt': string;
    };
    nested: {
      'post': Schema['post']['plain'] & Schema['post']['nested'];
    };
    flat: {
      'post:id': number;
      'post:userId': number;
      'post:title': string;
      'post:body': string;
      'post:createdAt': string;
      'post:updatedAt': string;
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
      'store:address:id': number;
      'store:address:zipCode': string;
      'store:address:address': string;
      'store:address:storeId': number;
      'store:address:createdAt': string;
      'store:address:updatedAt': string;
      'store:address:nearStates': Array<{code: number; name: string}>;
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
      'dvd:store:address:id': number;
      'dvd:store:address:zipCode': string;
      'dvd:store:address:address': string;
      'dvd:store:address:storeId': number;
      'dvd:store:address:createdAt': string;
      'dvd:store:address:updatedAt': string;
      'dvd:store:address:nearStates': Array<{code: number; name: string}>;
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
  'location': {
    plain: {
      'id': number;
      'zipCode': string;
      'address': string;
      'storeId': number;
      'createdAt': string;
      'updatedAt': string;
      'nearStates': Array<{code: number; name: string}>;
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
      'createdAt': string;
      'updatedAt': string;
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
  'store': {
    plain: {
      'id': number;
      'name': string;
      'ownerId': number;
      'ownerFullName': string;
    };
    nested: {
      'owner': Schema['owner']['plain'] & Schema['owner']['nested'];
      'address': Schema['location']['plain'] & Schema['location']['nested'];
    };
    flat: {
      'owner:id': number;
      'owner:firstName': string;
      'owner:lastName': string;
      'owner:fullName': string;
      'address:id': number;
      'address:zipCode': string;
      'address:address': string;
      'address:storeId': number;
      'address:createdAt': string;
      'address:updatedAt': string;
      'address:nearStates': Array<{code: number; name: string}>;
    };
  };
};
