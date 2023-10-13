import { LeafField } from '@forestadmin/datasource-replica';
import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import {
  GraphQLField,
  GraphQLList,
  GraphQLOutputType,
  GraphQLSchema,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
} from 'graphql';

import GQLCollectionSchema from './collections';
import { GQLCollectionType, GQLRelation } from './type';

function getGQLTypeOverNotNull(type: GraphQLOutputType) {
  return isNonNullType(type) ? type.ofType : type;
}

function getListSubGQLType(listType: GraphQLList<GraphQLOutputType>) {
  const type = getGQLTypeOverNotNull(listType.ofType);

  return (isObjectType(type) || isInterfaceType(type)) && type;
}

function extractCollectionFromGQLQuery(
  query: GraphQLField<unknown, unknown, unknown>,
): GQLCollectionType {
  const type = getListSubGQLType(
    getGQLTypeOverNotNull(query.type) as GraphQLList<GraphQLOutputType>,
  );

  return {
    queryName: query.name,
    name: type.name,
    fields: Object.values(type.getFields()),
  };
}

function getTypeFromGQLType(type: string): PrimitiveTypes {
  switch (type) {
    case 'Int':
    case 'Float':
      return 'Number';
    case 'Boolean':
      return 'Boolean';
    case /.*date.*/i.test(type) && type:
      return 'Date';
    case /.*id.*/i.test(type) && type:
    case 'String':
    default:
      return 'String';
  }
}

function isGQLTypeAreCollection(collections: GQLCollectionType[], name: string) {
  return collections.some(collection => collection.name === name);
}

export default async function getSchema(gqlSchema: GraphQLSchema): Promise<GQLCollectionSchema[]> {
  const collections = Object.values(gqlSchema.getQueryType().getFields())
    .filter(query => isListType(getGQLTypeOverNotNull(query.type)))
    .map(query => extractCollectionFromGQLQuery(query));

  // TODO: handle has one
  // TODO: required from mutation query
  // TODO: enhance models with mutation

  const hasManyRelations: GQLRelation = [];
  const belongsToRelations: GQLRelation = [];

  const schema = collections.map((collection): GQLCollectionSchema => {
    const fields = collection.fields.reduce((definition: Record<string, LeafField>, field) => {
      const type = getGQLTypeOverNotNull(field.type);

      if (isScalarType(type)) {
        definition[field.name] = {
          type: getTypeFromGQLType(type.name),
          isPrimaryKey: field.name === 'id',
        };
      } else if (isObjectType(type)) {
        if (isGQLTypeAreCollection(collections, type.name)) {
          belongsToRelations.push({
            collectionName: collection.name,
            relationName: field.name,
            targetCollection: type.name,
          });
        } else {
          // TODO: handle not listable ressource as JSON or collection
        }
      } else if (isListType(type)) {
        const subType = getListSubGQLType(type);

        if (isGQLTypeAreCollection(collections, subType.name)) {
          hasManyRelations.push({
            collectionName: subType.name,
            relationName: field.name,
            targetCollection: collection.name,
          });
        } else {
          // TODO: handle not listable ressource as array of JSON type or collection
        }
      }

      return definition;
    }, {});

    return new GQLCollectionSchema(collection.name, fields, collection.queryName);
  });

  belongsToRelations.forEach(belongsToRelation => {
    const collection = schema.find(s => s.name === belongsToRelation.collectionName);
    const targetCollection = schema.find(s => s.name === belongsToRelation.targetCollection);

    const hasManyRelation = hasManyRelations.find(
      relation =>
        relation.collectionName === collection.name &&
        relation.targetCollection === targetCollection.name,
    );

    const targetField = Object.entries(targetCollection.fields).find(
      ([_, definition]) => definition.isPrimaryKey,
    )[0];

    collection.addRelation(
      {
        type: getTypeFromGQLType('ID'),
        reference: {
          relationName: belongsToRelation.relationName,
          targetCollection: belongsToRelation.targetCollection,
          targetField,
          relationInverse: hasManyRelation?.relationName,
        },
      },
      targetCollection,
    );
  });

  return schema;
}
