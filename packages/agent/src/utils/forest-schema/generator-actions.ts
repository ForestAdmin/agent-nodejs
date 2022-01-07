import {
  ActionField,
  ActionFieldType,
  ActionSchema,
  Collection,
  ColumnSchema,
  DataSource,
  PrimitiveTypes,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import path from 'path';
import { ForestServerAction, ForestServerActionField } from './types';

export default class SchemaGeneratorActions {
  /**
   * 'fields' sent to forestadmin-server when we want to generate the form on demand.
   * This works around a bug in frontend which won't call the server if no fields are defined.
   */
  private static defaultFields = [
    {
      field: 'Loading...',
      type: PrimitiveTypes.String,
      isReadOnly: true,
      defaultValue: 'Form is loading',
      description: '',
      enums: null,
      hook: null,
      isRequired: true,
      position: 0,
      reference: null,
      widget: null,
    },
  ];

  static async buildSchema(
    prefix: string,
    collection: Collection,
    name: string,
  ): Promise<ForestServerAction> {
    const schema = collection.schema.actions[name];
    const actionIndex = Object.keys(collection.schema.actions).indexOf(name);
    const slug = name.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, '-');

    return {
      name,
      type: schema.scope,
      baseUrl: null,
      endpoint: path.join('/', prefix, '_actions', collection.name, String(actionIndex), slug),
      httpMethod: 'POST',
      redirect: null, // frontend ignores this attribute
      download: Boolean(schema.forceDownload),
      fields: await SchemaGeneratorActions.buildFields(collection, name, schema),
      hooks: {
        load: Boolean(schema.generateFormOnUsage),

        // Always registering the change hook has no consequences, even if we don't use it.
        change: ['changeHook'],
      },
    };
  }

  private static async buildFields(
    collection: Collection,
    name: string,
    schema: ActionSchema,
  ): Promise<ForestServerActionField[]> {
    // We want the schema to be generated on usage => send dummy schema
    if (schema.generateFormOnUsage) {
      return SchemaGeneratorActions.defaultFields;
    }

    // Ask the action to generate a form
    const form = await collection.getAction(name).getForm();
    const fields = form?.fields.map((field, index) =>
      SchemaGeneratorActions.buildFieldSchema(collection.dataSource, field, index),
    );

    return fields ?? [];
  }

  private static buildFieldSchema(
    dataSource: DataSource,
    field: ActionField,
    index: number,
  ): ForestServerActionField {
    const base = SchemaGeneratorActions.buildBaseField(field, index);

    if (field.type === ActionFieldType.Collection) {
      const collection = dataSource.getCollection(field.collectionName);
      const [primaryKeyName] = SchemaUtils.getPrimaryKeys(collection.schema);
      const primaryKey = collection.schema.fields[primaryKeyName] as ColumnSchema;

      return {
        ...base,
        type: primaryKey.columnType,
        reference: `${collection.name}.${primaryKeyName}`,
        widget: 'belongsto select',
      };
    }

    if (field.type.endsWith('[]')) {
      return { ...base, type: [field.type.substring(0, field.type.length - 2) as PrimitiveTypes] };
    }

    if (field.type === ActionFieldType.File) {
      return { ...base, type: PrimitiveTypes.String, widget: 'file picker' };
    }

    return { ...base, type: field.type as unknown as PrimitiveTypes };
  }

  private static buildBaseField(
    field: ActionField,
    index: number,
  ): Omit<ForestServerActionField, 'type'> {
    return {
      defaultValue: field.defaultValue,
      description: field.description,
      enums: field.enumValues,
      field: field.label,
      hook: field.reloadOnChange ? 'changeHook' : null,
      isReadOnly: field.isReadOnly,
      isRequired: field.isRequired,
      position: index,
      reference: null,
      widget: null,
    };
  }
}
