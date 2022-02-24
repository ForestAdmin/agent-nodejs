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
  private static defaultFields: ForestServerActionField[] = [
    {
      field: 'Loading...',
      type: PrimitiveTypes.String,
      isReadOnly: true,
      defaultValue: 'Form is loading',
      value: undefined,
      description: '',
      enums: null,
      hook: null,
      isRequired: false,
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

    // Generate url-safe friendly name (which won't be unique, but that's OK).
    const slug = name.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const fields = await SchemaGeneratorActions.buildFields(collection, name, schema);

    return {
      id: `${collection.name}-${actionIndex}-${slug}`,
      name,
      type: schema.scope,
      baseUrl: null,
      endpoint: path.join('/', prefix, '_actions', collection.name, String(actionIndex), slug),
      httpMethod: 'POST',
      redirect: null, // frontend ignores this attribute
      download: Boolean(schema.generateFile),
      fields,
      hooks: {
        load: !schema.staticForm,

        // Always registering the change hook has no consequences, even if we don't use it.
        change: ['changeHook'],
      },
    };
  }

  /** Build schema for given field */
  static buildFieldSchema(dataSource: DataSource, field: ActionField): ForestServerActionField {
    const output: Record<string, unknown> = {};
    output.field = field.label;
    output.description = field.description;
    output.isRequired = field.isRequired;
    output.isReadOnly = field.isReadOnly;

    if (field.watchChanges) {
      output.hook = 'changeHook';
    }

    if (field.type === ActionFieldType.Collection) {
      const collection = dataSource.getCollection(field.collectionName);
      const [pk] = SchemaUtils.getPrimaryKeys(collection.schema);
      const pkSchema = collection.schema.fields[pk] as ColumnSchema;

      output.type = pkSchema.columnType;
      output.reference = `${collection.name}.${pk}`;
    } else if (field.type.endsWith('[]')) {
      output.type = [field.type.substring(0, field.type.length - 2) as PrimitiveTypes];
    } else {
      output.type = field.type as unknown as PrimitiveTypes;
    }

    if (field.type === ActionFieldType.Enum || field.type === ActionFieldType.EnumList) {
      output.enums = field.enumValues;
      output.value = field.enumValues.includes(field.value as string) ? field.value : null;
    } else {
      output.value = field.value;
    }

    return output as ForestServerActionField;
  }

  private static async buildFields(
    collection: Collection,
    name: string,
    schema: ActionSchema,
  ): Promise<ForestServerActionField[]> {
    // We want the schema to be generated on usage => send dummy schema
    if (!schema.staticForm) {
      return SchemaGeneratorActions.defaultFields;
    }

    // Ask the action to generate a form
    const fields = await collection.getForm(name);

    if (fields) {
      // When sending to server, we need to rename 'value' into 'defaultValue'
      // otherwise, it does not gets applied 🤷‍♂️
      return fields.map(field => {
        const newField = SchemaGeneratorActions.buildFieldSchema(collection.dataSource, field);
        newField.defaultValue = newField.value;
        delete newField.value;

        return newField;
      });
    }

    return [];
  }
}
