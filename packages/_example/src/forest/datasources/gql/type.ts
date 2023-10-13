import { GraphQLField } from 'graphql';

export type GQLCollectionType = {
  queryName: string;
  name: string;
  fields: GraphQLField<unknown, unknown>[];
};

export type GQLRelation = {
  collectionName: string;
  relationName: string;
  targetCollection: string;
}[];
