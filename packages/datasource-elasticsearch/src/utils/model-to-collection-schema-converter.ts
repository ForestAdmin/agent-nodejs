/* eslint-disable max-len */
import {
  MappingFieldType,
  MappingJoinProperty,
  MappingProperty,
} from '@elastic/elasticsearch/api/types';
import {
  CollectionSchema,
  ColumnSchema,
  FieldSchema,
  Logger,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';

import TypeConverter from './type-converter';
import ModelElasticsearch from '../model-builder/model';

export default class ModelToCollectionSchemaConverter {
  // Handle JOIN https://www.elastic.co/guide/en/elasticsearch/reference/master/parent-join.html
  //   The parent-join creates one field to index the name of the relation within the document (my_parent, my_child, …).

  // It also creates one field per parent/child relation. The name of this field is the name of the join field followed by # and the name of the parent in the relation. So for instance for the my_parent → [my_child, another_child] relation, the join field creates an additional field named my_join_field#my_parent.

  // This field contains the parent _id that the document links to if the document is a child (my_child or another_child) and the _id of document if it’s a parent (my_parent).

  // "my_join_field": {
  //   "name": "answer",
  //   "parent": "1"
  // }

  // my_join_field#answer

  private static convertAssociation(association: string | string[]): RelationSchema {
    if (association) {
      if (Array.isArray(association))
        return {
          foreignCollection: association[0],
          foreignKey: 'parent',
          foreignKeyTarget: '_id', // parent._id
          type: 'ManyToOne',
        };

      return {
        foreignCollection: association,
        foreignKey: '',
        foreignKeyTarget: '_id', // parent._id
        type: 'ManyToOne',
      };
    }
  }

  private static convertAssociations(
    modelName: string,
    associations: MappingJoinProperty,
    logger: Logger,
  ): CollectionSchema['fields'] {
    const schemaAssociations = {};

    if (associations.relations) {
      Object.entries(associations.relations).forEach(([name, association]) => {
        try {
          // name is parent of association
          schemaAssociations[name] = this.convertAssociation(association);
        } catch (error) {
          logger?.('Warn', `Skipping association '${modelName}.${name}' (${error.message})`);
        }
      });
    }

    return schemaAssociations;
  }

  private static convertAttribute(attribute: MappingProperty): FieldSchema {
    const elasticsearchColumnType = attribute.type;

    const columnType = TypeConverter.fromDataType(elasticsearchColumnType as MappingFieldType);
    const filterOperators = TypeConverter.operatorsForColumnType(columnType);

    const column: ColumnSchema = {
      columnType,
      filterOperators,
      type: 'Column',
      validation: [],
      isReadOnly: attribute.type === 'alias',
      isSortable: true,
    };

    return column;
  }

  private static convertAttributes(
    modelName: string,
    attributes: Record<string, MappingProperty>,
    logger: Logger,
  ): CollectionSchema['fields'] {
    const fields: CollectionSchema['fields'] = {};

    Object.entries(attributes).forEach(([name, attribute]) => {
      try {
        if (attribute.type === 'join') {
          Object.assign(fields, {
            ...this.convertAssociations(modelName, attribute as MappingJoinProperty, logger),
          });
        } else {
          fields[name] = this.convertAttribute(attribute);
        }
      } catch (error) {
        logger?.('Warn', `Skipping column '${modelName}.${name}' (${error.message})`);
      }
    });

    // TODO: Push _id
    // Virtual field
    const defaultPrimaryColumn: ColumnSchema = {
      columnType: 'String',
      type: 'Column',
      filterOperators: TypeConverter.operatorsForId(),
      validation: [],
      isReadOnly: true,
      isSortable: false,
      isPrimaryKey: true,
    };

    // eslint-disable-next-line no-underscore-dangle
    fields._id = defaultPrimaryColumn;

    // eslint-disable-next-line max-len
    // https://www.elastic.co/guide/en/elasticsearch/reference/master/mapping-fields.html#_identity_metadata_fields

    return fields;
  }

  public static convert(model: ModelElasticsearch, logger: Logger): CollectionSchema {
    if (!model) throw new Error('Invalid (null) model.');

    return {
      actions: {},
      charts: [],
      countable: true,
      fields: {
        ...this.convertAttributes(model.name, model.getAttributes(), logger),
      },
      searchable: false,
      segments: [],
    };
  }
}
