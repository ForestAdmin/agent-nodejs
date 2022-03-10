import {
  CollectionSchema,
  DataSourceSchema,
  FieldTypes,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { LiveDataSource } from '@forestadmin/datasource-live';

const companyCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
  },
  searchable: false,
  segments: [],
};

const syndicateCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    users: {
      foreignCollection: 'user',
      foreignKey: 'userId',
      originRelation: 'syndicate',
      otherField: 'syndicateId',
      targetRelation: 'users',
      throughCollection: 'userSyndicate',
      type: FieldTypes.ManyToMany,
    },
  },
  searchable: false,
  segments: [],
};

const userCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    email: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    companyId: {
      foreignCollection: 'companie',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
    items: {
      foreignCollection: 'item',
      foreignKey: 'userId',
      type: FieldTypes.OneToMany,
    },
    syndicate: {
      foreignCollection: 'syndicate',
      foreignKey: 'syndicateId',
      originRelation: 'user',
      otherField: 'userId',
      targetRelation: 'syndicate',
      throughCollection: 'userSyndicate',
      type: FieldTypes.ManyToMany,
    },
  },
  searchable: false,
  segments: [],
};

const userSyndicateCollection: CollectionSchema = {
  actions: {},
  fields: {
    rating2: {
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    user: {
      foreignCollection: 'user',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
    syndicate: {
      foreignCollection: 'syndicate',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
  },
  searchable: false,
  segments: [],
};

const itemCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    value: {
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    userId: {
      foreignCollection: 'user',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
  },
  searchable: false,
  segments: [],
};

const itemReferenceCollection: CollectionSchema = {
  actions: {},
  fields: {
    reference: {
      columnType: PrimitiveTypes.String,
      type: FieldTypes.Column,
    },
    itemId: {
      foreignCollection: 'item',
      foreignKey: 'id',
      type: FieldTypes.OneToOne,
    },
  },
  searchable: false,
  segments: [],
};

const dataSourceSchema: DataSourceSchema = {
  collections: {
    companie: companyCollection,
    itemReference: itemReferenceCollection,
    item: itemCollection,
    syndicate: syndicateCollection,
    user: userCollection,
    userSyndicate: userSyndicateCollection,
  },
};

async function loadLiveDataSource(dataSource) {
  const companyRecords = [{ name: 'Forest Admin' }, { name: 'Lumber Jacks Incorporated' }];
  const syndicateRecords = [{ name: 'Tree Saviours' }, { name: 'Hatchet Lovers' }];
  const userRecords = [];
  const itemRecords = [];
  const itemReferenceRecords = [];
  const userSyndicateRecords = [];

  const companies = await dataSource.getCollection('companie').create(companyRecords);

  companies.forEach(company => {
    for (let i = 0; i < 5; i += 1) {
      const userName = `User ${i.toString().padStart(2, '0')} (${company.name})`;
      const domainName = company.name.replace(/ /g, '').toLowerCase();

      userRecords.push({
        name: userName,
        email: `${userName}@${domainName}.com`,
        companyId: company.id,
      });
    }
  });

  const syndicates = await dataSource.getCollection('syndicate').create(syndicateRecords);

  const users = await dataSource.getCollection('user').create(userRecords);

  users.forEach(user => {
    for (let i = 0; i < 5; i += 1) {
      const itemName = `Item ${i.toString().padStart(2, '0')} for ${user.name}`;

      itemReferenceRecords.push({
        reference: `ref-${i.toString().padStart(3, '0')}-${user.name}`,
      });

      itemRecords.push({
        name: itemName,
        value: 9000 + user.id * 10 + i,
        userId: user.id,
      });
    }

    userSyndicateRecords.push({
      userId: user.id,
      syndicateId: syndicates[user.id % 2].id,
      rating: (user.id + (user.id % 2)) % 3,
    });
  });

  await dataSource.getCollection('userSyndicate').create(userSyndicateRecords);

  const itemReferences = await dataSource
    .getCollection('itemReference')
    .create(itemReferenceRecords);

  itemReferences.forEach((itemReference, index) => {
    itemRecords[index].itemReferenceId = itemReference.id;
  });

  await dataSource.getCollection('item').create(itemRecords);
}

export default async (): Promise<LiveDataSource> => {
  const dataSource = new LiveDataSource(dataSourceSchema);

  await dataSource.syncCollections();
  await loadLiveDataSource(dataSource);

  return dataSource;
};
