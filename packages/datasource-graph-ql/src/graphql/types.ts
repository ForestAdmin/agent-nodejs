import { ColumnType } from '@forestadmin/datasource-toolkit';
import { GraphQLField } from 'graphql';

export type GraphQLModelField = { name: string; type: ColumnType; isPrimaryKey?: boolean };
export type GraphQLModelRelation = { name: string; reference: string; identifier?: string };

type Model = {
  name: string;
  queryName: string;
  getOneQueryName: string;
  getOnQueryIdentifier: string;
};

export type GraphQLModel = Model & {
  fields: GraphQLModelField[];
  relations: GraphQLModelRelation[];
};
export type IntrospectionModel = Model & {
  fields: GraphQLField<unknown, unknown, unknown>[];
};
