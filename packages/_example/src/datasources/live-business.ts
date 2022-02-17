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
    user: {
      foreignCollection: 'users',
      foreignKey: 'userId',
      originRelation: 'syndicates',
      otherField: 'syndicateId',
      targetRelation: 'users',
      throughCollection: 'userSyndicates',
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
      foreignCollection: 'companies',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
    items: {
      foreignCollection: 'items',
      foreignKey: 'userId',
      type: FieldTypes.OneToMany,
    },
    syndicates: {
      foreignCollection: 'syndicates',
      foreignKey: 'syndicateId',
      originRelation: 'users',
      otherField: 'userId',
      targetRelation: 'syndicates',
      throughCollection: 'userSyndicates',
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
    users: {
      foreignCollection: 'users',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
    syndicates: {
      foreignCollection: 'syndicates',
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
      foreignCollection: 'users',
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
      foreignCollection: 'items',
      foreignKey: 'id',
      type: FieldTypes.OneToOne,
    },
  },
  searchable: false,
  segments: [],
};

const dataSourceSchema: DataSourceSchema = {
  collections: {
    companies: companyCollection,
    itemReferences: itemReferenceCollection,
    items: itemCollection,
    syndicates: syndicateCollection,
    users: userCollection,
    userSyndicates: userSyndicateCollection,
  },
};

const prepareDataSource = async (): Promise<LiveDataSource> => {
  const dataSource = new LiveDataSource(dataSourceSchema);

  await dataSource.syncCollections();
  await loadLiveDataSource(dataSource);

  return dataSource;
};

export default prepareDataSource;
