import {
  CollectionSchema,
  DataSourceSchema,
  FieldTypes,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { LiveDataSource } from '@forestadmin/datasource-live';

import loadLiveDataSource from './live-business-data';

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

const prepareDataSource = async (): Promise<LiveDataSource> => {
  const dataSource = new LiveDataSource(dataSourceSchema);

  await dataSource.syncCollections();
  await loadLiveDataSource(dataSource);

  return dataSource;
};

export default prepareDataSource;
