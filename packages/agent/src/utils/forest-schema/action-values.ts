import type { ActionField, CompositeId, DataSource, File } from '@forestadmin/datasource-toolkit';

import { isDataUri, makeDataUri, parseDataUri } from '@forestadmin/datasource-toolkit';

import ActionFields from './action-fields';
import SchemaGeneratorActions from './generator-actions';
import IdUtils from '../id';

type FormData = Record<string, unknown>;

/**
 * This utility class converts form values from our internal format to the format that is
 * used in the frontend for action forms.
 */
export default class ForestValueConverter {
  /**
   * Proper form data parser which converts data from an action form result to the format
   * that is internally used in datasources.
   */
  static makeFormData(dataSource: DataSource, rawData: FormData, fields: ActionField[]): FormData {
    const data = {};

    for (const [key, value] of Object.entries(rawData)) {
      const field = fields.find(f => f.id === key);

      // Skip fields from the default form
      if (!SchemaGeneratorActions.defaultFields.map(f => f.field).includes(key)) {
        if (ActionFields.isCollectionField(field) && value) {
          const collection = dataSource.getCollection(field.collectionName);

          data[key] = IdUtils.unpackId(collection.schema, value as string);
        } else if (ActionFields.isFileField(field) && value) {
          data[key] = parseDataUri(value as string);
        } else if (ActionFields.isFileListField(field) && value) {
          data[key] = (value as string[])?.map(v => parseDataUri(v));
        } else {
          data[key] = value;
        }
      }
    }

    return data;
  }

  /**
   * Form data parser which extracts the data from what is provided by the frontend when
   * change hooks are called.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static makeFormDataFromFields(dataSource: DataSource, fields: any[]): FormData {
    const data: FormData = {};

    for (const field of fields) {
      // Skip fields from the default form
      if (!SchemaGeneratorActions.defaultFields.map(f => f.field).includes(field.field)) {
        if (field.reference && field.value) {
          const [collectionName] = field.reference.split('.');
          const collection = dataSource.getCollection(collectionName);
          data[field.field] = IdUtils.unpackId(collection.schema, field.value as string);
        } else if (field.type === 'File') {
          data[field.field] = isDataUri(field.value) ? parseDataUri(field.value) : field.value;
        } else if (Array.isArray(field.type) && field.type[0] === 'File') {
          data[field.field] = (field.value as string[])?.map(v =>
            isDataUri(v) ? parseDataUri(v) : v,
          );
        } else {
          data[field.field] = field.value;
        }
      }
    }

    return data;
  }

  /**
   * This last form data parser tries to guess the types from the data itself.
   *
   * - Fields with type "Collection" which target collections where the pk is not a string or
   * derivative (mongoid, uuid, ...) won't be parser correctly, as we don't have enough information
   * to properly guess the type
   * - Fields of type "String" but where the final user entered a data-uri manually in the frontend
   * will be wrongfully parsed.
   */
  static makeFormDataUnsafe(rawData: FormData): FormData {
    const data: FormData = {};

    for (const [key, value] of Object.entries(rawData)) {
      // Skip fields from the default form
      if (!SchemaGeneratorActions.defaultFields.map(f => f.field).includes(key)) {
        if (Array.isArray(value) && value.every(v => isDataUri(v))) {
          data[key] = value.map(uri => parseDataUri(uri));
        } else if (isDataUri(value)) {
          data[key] = parseDataUri(value as string);
        } else {
          data[key] = value;
        }
      }
    }

    return data;
  }

  static valueToForest(field: ActionField, value: unknown): unknown {
    if (ActionFields.isEnumField(field)) {
      return field.enumValues.includes(value as string) ? value : null;
    }

    if (ActionFields.isEnumListField(field)) {
      return (value as string[])?.filter(v => field.enumValues.includes(v));
    }

    if (field.type === 'Collection') {
      return (value as CompositeId)?.join('|');
    }

    if (field.type === 'File') {
      return makeDataUri(value as File);
    }

    if (field.type === 'FileList') {
      return (value as File[])?.map(f => makeDataUri(f));
    }

    return value;
  }
}
