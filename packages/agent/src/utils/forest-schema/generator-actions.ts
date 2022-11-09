import {
  ActionField,
  ActionSchema,
  Collection,
  ColumnSchema,
  DataSource,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import path from 'path';

import ForestValueConverter from './action-values';
import { ForestServerAction, ForestServerActionField } from './types';

export default class SchemaGeneratorActions {
  /**
   * 'fields' sent to forestadmin-server when we want to generate the form on demand.
   * This works around a bug in frontend which won't call the server if no fields are defined.
   */
  static defaultFields: ForestServerActionField[] = [
    {
      field: 'Loading...',
      type: 'String',
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

  static async buildSchema(collection: Collection, name: string): Promise<ForestServerAction> {
    const schema = collection.schema.actions[name];
    const actionIndex = Object.keys(collection.schema.actions).indexOf(name);

    // Generate url-safe friendly name (which won't be unique, but that's OK).
    const slug = name.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const fields = await SchemaGeneratorActions.buildFields(collection, name, schema);

    return {
      id: `${collection.name}-${actionIndex}-${slug}`,
      name,
      type: schema.scope.toLowerCase() as 'single' | 'bulk' | 'global',
      baseUrl: null,
      endpoint: path.posix.join('/forest/_actions', collection.name, String(actionIndex), slug),
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
    const { label, description, isRequired, isReadOnly, watchChanges, type } = field;
    const output = { description, isRequired, isReadOnly } as Record<string, unknown>;

    output.field = label;
    output.value = ForestValueConverter.valueToForest(field, field.value);

    if (watchChanges) output.hook = 'changeHook';

    if (type === 'Collection') {
      const collection = dataSource.getCollection(field.collectionName);
      const [pk] = collection.schema.primaryKeys;
      const pkSchema = collection.schema.fields[pk] as ColumnSchema;

      output.type = pkSchema.columnType;
      output.reference = `${collection.name}.${pk}`;
    } else if (type.endsWith('List')) {
      output.type = [type.substring(0, type.length - 4) as PrimitiveTypes];
    } else {
      output.type = type as unknown as PrimitiveTypes;
    }

    if (type === 'Enum' || type === 'EnumList') {
      output.enums = field.enumValues;
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
    const fields = await collection.getForm(null, name);

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
