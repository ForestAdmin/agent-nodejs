import { Logger, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import {
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  getNamedType,
  isListType,
  isNonNullType,
  isScalarType,
  isTypeSubTypeOf,
} from 'graphql';

import { GraphQLModel, GraphQLModelField, GraphQLModelRelation, IntrospectionModel } from './types';
import { GraphQLOptions } from '../types';

export default class SchemaIntrospector {
  private readonly logger: Logger;
  private readonly options: GraphQLOptions;
  private readonly schema: GraphQLSchema;
  private readonly scalaridentifier: string;
  private readonly models: IntrospectionModel[];

  constructor(logger: Logger, options: GraphQLOptions, schema: GraphQLSchema) {
    this.logger = logger;
    this.options = options;
    this.schema = schema;
    this.scalaridentifier = options.scalarIdentifier || 'ID';
    this.models = this.computeModels();
  }

  private extractModelFromGQLQuery(
    query: GraphQLField<unknown, unknown, unknown>,
  ): IntrospectionModel {
    const connection = getNamedType(query.type) as GraphQLObjectType;
    const edges = getNamedType(connection.getFields().edges.type) as GraphQLObjectType;
    const node = getNamedType(edges.getFields().node.type) as GraphQLObjectType;

    const getOneQuery = Object.values(this.schema.getQueryType().getFields())
      .filter(({ type }) => getNamedType(type) === node)
      .find(({ args }) =>
        args.some(({ type }) => getNamedType(type).name === this.scalaridentifier),
      );

    if (!getOneQuery) {
      this.logger('Warn', `Get one query was not found for entity "${node.name}".`);
    }

    const identifierArg = getOneQuery?.args?.find(
      ({ type }) => getNamedType(type).name === this.scalaridentifier,
    );

    return {
      name: node.name,
      fields: Object.values(node.getFields()),
      queryName: query.name,
      getOneQueryName: getOneQuery?.name,
      getOnQueryIdentifier: identifierArg?.name,
    };
  }

  private computeModels(): IntrospectionModel[] {
    const connectionType = this.schema.getType('Connection') as GraphQLInterfaceType;

    return Object.values(this.schema.getQueryType().getFields())
      .filter(query => isTypeSubTypeOf(this.schema, query.type, connectionType))
      .map(query => this.extractModelFromGQLQuery(query));
  }

  private getPrimitiveType(type: string): PrimitiveTypes {
    switch (type) {
      case 'Int':
      case 'Float':
        return 'Number';
      case 'Boolean':
        return 'Boolean';
      case 'ID':
      case 'String':
        return 'String';

      default: {
        const mappingType = this.options.scalarMapping[type];

        if (!mappingType)
          this.logger(
            'Warn',
            `Unrecognized type "${type}" please use "scalarMapping" option if it is a custom type.`,
          );

        return mappingType;
      }
    }
  }

  private isTypeAreBelongsToModel(typeName: string) {
    return this.models.some(model => model.name === typeName && !!model.getOneQueryName);
  }

  private extractFieldsFromGQLField(
    fields: IntrospectionModel['fields'],
    deep = true,
  ): { fields: GraphQLModelField[]; relations: GraphQLModelRelation[] } {
    return fields.reduce(
      (definition: { fields: GraphQLModelField[]; relations: GraphQLModelRelation[] }, field) => {
        const type = getNamedType(field.type) as GraphQLObjectType;
        const typeList = isNonNullType(field.type) ? field.type.ofType : field.type;
        const isList = isListType(typeList);

        if (isScalarType(type)) {
          const primitiveType = this.getPrimitiveType(type.name);

          if (primitiveType) {
            const isPrimaryKey = type.name === this.scalaridentifier;

            definition.fields.push({
              name: field.name,
              type: isList ? [primitiveType] : primitiveType,
              isPrimaryKey,
            });
          }
        } else if (deep) {
          if (!isList && this.isTypeAreBelongsToModel(type.name)) {
            definition.relations.push({ name: field.name, reference: type.name });
          } else {
            const def = this.extractFieldsFromGQLField(Object.values(type.getFields()), false);
            const jsonType = def.fields.reduce((acc, f) => {
              acc[f.name] = f.type;

              return acc;
            }, {});

            definition.fields.push({ name: field.name, type: isList ? [jsonType] : jsonType });
          }
        }

        return definition;
      },
      { fields: [], relations: [] },
    );
  }

  getModels(): GraphQLModel[] {
    const models = this.models.map(model => {
      const definition = this.extractFieldsFromGQLField(model.fields);

      return { ...model, ...definition };
    });

    models.forEach(model => {
      model.relations.forEach(relation => {
        const reference = models.find(({ name }) => name === relation.reference);
        const identifier = reference.fields.find(({ isPrimaryKey }) => isPrimaryKey);
        relation.identifier = identifier.name;
      });
    });

    return models;
  }
}
