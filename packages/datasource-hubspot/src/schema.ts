import { CachedCollectionSchema, ColumnType } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';

import { getRelationNames } from './relations';
import { FieldProperties, FieldPropertiesByCollection, HubSpotOptions } from './types';

function getCollectionSchema(
  collectionName: string,
  fields: string[],
  fieldProperties: FieldProperties,
  logger?: Logger,
): CachedCollectionSchema {
  const collection: CachedCollectionSchema = {
    name: collectionName,
    fields: {
      id: { type: 'String', isPrimaryKey: true, isReadOnly: true },
    },
  };

  for (const fieldName of fields) {
    const property = fieldProperties.find(p => p.name === fieldName);
    if (!property) throw new Error(`property ${fieldName} does not exists`);

    let type: ColumnType;
    let enumValues: string[];

    if (property.type === 'string') type = 'String';
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

function getCollectionManyToManySchema(
  fromCollectionName: string,
  toCollectionName: string,
): CachedCollectionSchema {
  return {
    name: `${fromCollectionName}_${toCollectionName}`,
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
  } as CachedCollectionSchema;
}

export default function getSchema<TypingsHubspot>(
  fieldPropertiesByCollection: FieldPropertiesByCollection,
  collections: HubSpotOptions<TypingsHubspot>['collections'],
  logger?: Logger,
): CachedCollectionSchema[] {
  const schema = Object.entries(collections).map(([collectionName, fields]) =>
    getCollectionSchema(
      collectionName,
      fields,
      fieldPropertiesByCollection[collectionName],
      logger,
    ),
  );

  getRelationNames(Object.keys(collections)).forEach(manyToMany => {
    const [fromCollectionName, toCollectionName] = manyToMany.split('_');
    schema.push(getCollectionManyToManySchema(fromCollectionName, toCollectionName));
  });

  return schema;
}
