/* eslint-disable */
export type Schema = {
  address: {
    plain: {
      id: number;
      zipCode: string;
      address: string;
      storeId: number;
      createdAt: string;
      updatedAt: string;
    };
    nested: {
      store: Schema['store']['plain'] & Schema['store']['nested'];
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
  card: {
    plain: {
      id: number;
      card_number: number;
      card_type: 'visa' | 'mastercard' | 'american express';
      is_active: boolean;
      customer_id: number;
    };
    nested: {
      customer: Schema['customer']['plain'] & Schema['customer']['nested'];
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
  comment: {
    plain: {
      id: number;
      postId: number;
      name: string;
      email: string;
      body: string;
    };
    nested: {
      post: Schema['post']['plain'] & Schema['post']['nested'];
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
  customer: {
    plain: {
      id: number;
      name: string;
      firstName: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string;
    };
    nested: {};
    flat: {};
  };
  dvd: {
    plain: {
      id: number;
      title: string;
      rentalPrice: number;
      storeId: number;
      numberOfRentals: number;
    };
    nested: {
      store: Schema['store']['plain'] & Schema['store']['nested'];
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
    };
  };
  dvd_rental: {
    plain: {
      dvdId: number;
      rentalId: number;
    };
    nested: {
      dvd: Schema['dvd']['plain'] & Schema['dvd']['nested'];
      rental: Schema['rental']['plain'] & Schema['rental']['nested'];
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
  owner: {
    plain: {
      id: number;
      firstName: string;
      lastName: string;
      fullName: string;
    };
    nested: {};
    flat: {};
  };
  ownerMongo: {
    plain: {
      name: string;
      _id: string;
    };
    nested: {};
    flat: {};
  };
  post: {
    plain: {
      id: number;
      userId: number;
      title: string;
      body: string;
    };
    nested: {
      owner: Schema['owner']['plain'] & Schema['owner']['nested'];
    };
    flat: {
      'owner:id': number;
      'owner:firstName': string;
      'owner:lastName': string;
      'owner:fullName': string;
    };
  };
  rental: {
    plain: {
      id: number;
      startDate: string;
      endDate: string;
      customerId: number;
      numberOfDays: number;
    };
    nested: {
      customer: Schema['customer']['plain'] & Schema['customer']['nested'];
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
  review: {
    plain: {
      title: string;
      message: string;
      rating: number;
      storeId: number;
      testArrayIds: Array<number>;
      ownerIds: string;
      oldOwnerIds: string;
      _id: string;
    };
    nested: {
      store: Schema['store']['plain'] & Schema['store']['nested'];
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
    };
  };
  review__ownerMongo__oldOwnerIds: {
    plain: {
      review_id: string;
      ownerMongo_id: string;
    };
    nested: {
      review_id__oldOwnerIds__manyToOne: Schema['review']['plain'] & Schema['review']['nested'];
      ownerMongo_id__oldOwnerIds__manyToOne: Schema['ownerMongo']['plain'] & Schema['ownerMongo']['nested'];
    };
    flat: {
      'review_id__oldOwnerIds__manyToOne:title': string;
      'review_id__oldOwnerIds__manyToOne:message': string;
      'review_id__oldOwnerIds__manyToOne:rating': number;
      'review_id__oldOwnerIds__manyToOne:storeId': number;
      'review_id__oldOwnerIds__manyToOne:testArrayIds': Array<number>;
      'review_id__oldOwnerIds__manyToOne:ownerIds': string;
      'review_id__oldOwnerIds__manyToOne:oldOwnerIds': string;
      'review_id__oldOwnerIds__manyToOne:_id': string;
      'review_id__oldOwnerIds__manyToOne:store:id': number;
      'review_id__oldOwnerIds__manyToOne:store:name': string;
      'review_id__oldOwnerIds__manyToOne:store:ownerId': number;
      'review_id__oldOwnerIds__manyToOne:store:ownerFullName': string;
      'review_id__oldOwnerIds__manyToOne:store:owner:id': number;
      'review_id__oldOwnerIds__manyToOne:store:owner:firstName': string;
      'review_id__oldOwnerIds__manyToOne:store:owner:lastName': string;
      'review_id__oldOwnerIds__manyToOne:store:owner:fullName': string;
      'review_id__oldOwnerIds__manyToOne:store:address:id': number;
      'review_id__oldOwnerIds__manyToOne:store:address:zipCode': string;
      'review_id__oldOwnerIds__manyToOne:store:address:address': string;
      'review_id__oldOwnerIds__manyToOne:store:address:storeId': number;
      'review_id__oldOwnerIds__manyToOne:store:address:createdAt': string;
      'review_id__oldOwnerIds__manyToOne:store:address:updatedAt': string;
      'ownerMongo_id__oldOwnerIds__manyToOne:name': string;
      'ownerMongo_id__oldOwnerIds__manyToOne:_id': string;
    };
  };
  review__ownerMongo__ownerIds: {
    plain: {
      review_id: string;
      ownerMongo_id: string;
    };
    nested: {
      review_id__ownerIds__manyToOne: Schema['review']['plain'] & Schema['review']['nested'];
      ownerMongo_id__ownerIds__manyToOne: Schema['ownerMongo']['plain'] & Schema['ownerMongo']['nested'];
    };
    flat: {
      'review_id__ownerIds__manyToOne:title': string;
      'review_id__ownerIds__manyToOne:message': string;
      'review_id__ownerIds__manyToOne:rating': number;
      'review_id__ownerIds__manyToOne:storeId': number;
      'review_id__ownerIds__manyToOne:testArrayIds': Array<number>;
      'review_id__ownerIds__manyToOne:ownerIds': string;
      'review_id__ownerIds__manyToOne:oldOwnerIds': string;
      'review_id__ownerIds__manyToOne:_id': string;
      'review_id__ownerIds__manyToOne:store:id': number;
      'review_id__ownerIds__manyToOne:store:name': string;
      'review_id__ownerIds__manyToOne:store:ownerId': number;
      'review_id__ownerIds__manyToOne:store:ownerFullName': string;
      'review_id__ownerIds__manyToOne:store:owner:id': number;
      'review_id__ownerIds__manyToOne:store:owner:firstName': string;
      'review_id__ownerIds__manyToOne:store:owner:lastName': string;
      'review_id__ownerIds__manyToOne:store:owner:fullName': string;
      'review_id__ownerIds__manyToOne:store:address:id': number;
      'review_id__ownerIds__manyToOne:store:address:zipCode': string;
      'review_id__ownerIds__manyToOne:store:address:address': string;
      'review_id__ownerIds__manyToOne:store:address:storeId': number;
      'review_id__ownerIds__manyToOne:store:address:createdAt': string;
      'review_id__ownerIds__manyToOne:store:address:updatedAt': string;
      'ownerMongo_id__ownerIds__manyToOne:name': string;
      'ownerMongo_id__ownerIds__manyToOne:_id': string;
    };
  };
  store: {
    plain: {
      id: number;
      name: string;
      ownerId: number;
      ownerFullName: string;
    };
    nested: {
      owner: Schema['owner']['plain'] & Schema['owner']['nested'];
      address: Schema['address']['plain'] & Schema['address']['nested'];
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
    };
  };
};
