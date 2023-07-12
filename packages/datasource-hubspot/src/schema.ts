import { CachedCollectionSchema, ColumnType } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';

import { COLLECTIONS_RELATIONS } from './constants';
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
    else if (property.type === 'datetime') type = 'Date';
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

function getCollectionRelationSchema(
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

  const relationsToBuild = Object.keys(collections).filter(collectionName =>
    COLLECTIONS_RELATIONS.includes(collectionName),
  );
  relationsToBuild.forEach((fromCollectionName, index) => {
    for (let i = index + 1; i < relationsToBuild.length; i += 1) {
      schema.push(getCollectionRelationSchema(fromCollectionName, relationsToBuild[i]));
    }
  });

  return schema;
}
