import { CollectionReplicaSchema } from '@forestadmin/datasource-replica';
import { ColumnType, Logger } from '@forestadmin/datasource-toolkit';

import { buildManyToManyNames, getCollectionNames } from './relationships';
import { FieldPropertiesByCollection, FieldProperty, HubSpotOptions } from './types';

function getCollectionSchema(
  collectionName: string,
  fields: string[],
  fieldProperties: FieldProperty[],
  logger?: Logger,
): CollectionReplicaSchema {
  const collection: CollectionReplicaSchema = {
    name: collectionName,
    fields: {
      id: { type: 'String', isPrimaryKey: true, isReadOnly: true },
    },
  };

  for (const fieldName of fields) {
    let type: ColumnType;
    let enumValues: string[];

    const property = fieldProperties.find(p => p.name === fieldName);

    // Hubspot doesn't return all the created properties.
    // We can't know the type. So we assume it's a string.
    if (!property) {
      logger(
        'Warn',
        `Property "${fieldName}" doesn't be found in Hubspot. We assume it's a string`,
      );
      type = 'String';
    } else if (property.type === 'string') type = 'String';
    else if (property.type === 'datetime' || property.type === 'date') type = 'Date';
    else if (property.type === 'number') type = 'Number';
    else if (property.type === 'enumeration') {
      type = 'Enum';
      enumValues = property.options.map(option => option.value);
    } else if (property.type === 'bool') type = 'Boolean';
    else if (property.type === 'phone_number') type = 'String';
    else throw new Error(`Property "${fieldName}" has unsupported type ${property.type}`);

    if (enumValues?.length === 0) {
      logger?.('Warn', `Property "${fieldName}" has no enum values, it will be ignored.`);
    } else {
      collection.fields[fieldName] = { type, isPrimaryKey: false, isReadOnly: true, enumValues };
    }
  }

  return collection;
}

function getCollectionManyToManySchema(manyToManyName: string): CollectionReplicaSchema {
  const [fromCollectionName, toCollectionName] = getCollectionNames(manyToManyName);

  return {
    name: manyToManyName,
    fields: {
      [`${fromCollectionName}_id`]: {
        type: 'String',
        isPrimaryKey: true,
        isReadOnly: true,
        reference: {
          relationName: fromCollectionName,
          targetCollection: fromCollectionName,
          targetField: 'id',
          relationInverse: toCollectionName,
        },
      },
      [`${toCollectionName}_id`]: {
        type: 'String',
        isPrimaryKey: true,
        isReadOnly: true,
        reference: {
          relationName: toCollectionName,
          targetCollection: toCollectionName,
          targetField: 'id',
          relationInverse: fromCollectionName,
        },
      },
    },
  } as CollectionReplicaSchema;
}

export default function getSchema<TypingsHubspot>(
  fieldPropertiesByCollection: FieldPropertiesByCollection,
  collections: HubSpotOptions<TypingsHubspot>['collections'],
  logger?: Logger,
): CollectionReplicaSchema[] {
  const schema = Object.entries(collections).map(([collectionName, fields]) =>
    getCollectionSchema(
      collectionName,
      fields,
      fieldPropertiesByCollection[collectionName],
      logger,
    ),
  );

  buildManyToManyNames(Object.keys(collections)).forEach(manyToMany => {
    schema.push(getCollectionManyToManySchema(manyToMany));
  });

  return schema;
}
