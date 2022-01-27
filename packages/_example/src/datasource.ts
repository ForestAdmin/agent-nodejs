import { LiveDataSource } from '@forestadmin/datasource-live';
import {
  CollectionSchema,
  DataSourceSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';

const companyCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>([Operator.Equal]),
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
  },
  searchable: true,
  segments: [],
};

const userCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>([Operator.Equal]),
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
    email: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
    companyId: {
      foreignCollection: 'companies',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
  },
  searchable: true,
  segments: [],
};

const itemCollection: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>([Operator.Equal]),
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    name: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
    value: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
    userId: {
      foreignCollection: 'users',
      foreignKey: 'id',
      type: FieldTypes.ManyToOne,
    },
  },
  searchable: true,
  segments: [],
};

const dataSourceSchema: DataSourceSchema = {
  collections: {
    companies: companyCollection,
    items: itemCollection,
    users: userCollection,
  },
};
const dataSource = new LiveDataSource(dataSourceSchema);

export default dataSource;
