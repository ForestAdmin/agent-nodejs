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
      foreignKeyTarget: 'id',
      foreignRelation: 'user',
      originKey: 'syndicateId',
      originKeyTarget: 'id',
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
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    company: {
      foreignCollection: 'companie',
      foreignKey: 'companyId',
      foreignKeyTarget: 'id',
      type: FieldTypes.ManyToOne,
    },
    items: {
      foreignCollection: 'item',
      originKey: 'userId',
      originKeyTarget: 'id',
      type: FieldTypes.OneToMany,
    },
    syndicates: {
      foreignCollection: 'syndicate',
      foreignKey: 'syndicateId',
      foreignKeyTarget: 'id',
      foreignRelation: 'syndicate',
      originKey: 'userId',
      originKeyTarget: 'id',
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
    id: {
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    rating: {
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    userId: {
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    syndicateId: {
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    user: {
      foreignCollection: 'user',
      foreignKey: 'userId',
      foreignKeyTarget: 'id',
      type: FieldTypes.ManyToOne,
    },
    syndicate: {
      foreignCollection: 'syndicate',
      foreignKey: 'syndicateId',
      foreignKeyTarget: 'id',
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
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    user: {
      foreignCollection: 'user',
      foreignKey: 'userId',
      foreignKeyTarget: 'id',
      type: FieldTypes.ManyToOne,
    },
    reference: {
      foreignCollection: 'itemReference',
      originKey: 'itemId',
      originKeyTarget: 'id',
      type: FieldTypes.OneToOne,
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
      columnType: PrimitiveTypes.Number,
      type: FieldTypes.Column,
    },
    item: {
      foreignCollection: 'item',
      foreignKey: 'itemId',
      foreignKeyTarget: 'id',
      type: FieldTypes.ManyToOne,
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
