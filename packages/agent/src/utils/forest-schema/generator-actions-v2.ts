import {
  ActionField,
  ActionSchema,
  Collection,
  ColumnSchema,
  DataSource,
  PrimitiveTypes,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { ForestSchemaActionFieldV2, ForestSchemaActionV2 } from '@forestadmin/forestadmin-client';
import path from 'path';

import ActionFields from './action-fields';
import ForestValueConverter from './action-values';
import GeneratorActionFieldWidget from './generator-action-field-widget';

export default class SchemaGeneratorActionsV2 {
  static getActionSlug(name: string) {
    return name.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, '-');
  }

  static async buildSchema(collection: Collection, name: string): Promise<ForestSchemaActionV2> {
    const schema = collection.schema.actions[name];

    const actionIndex = Object.keys(collection.schema.actions).indexOf(name);

    // Generate url-safe friendly name (which won't be unique, but that's OK).
    const slug = SchemaGeneratorActionsV2.getActionSlug(name);

    return {
      id: `${collection.name}-${actionIndex}-${slug}`,
      name,
      scope: schema.scope.toLowerCase() as 'single' | 'bulk' | 'global',
      endpoint: path.posix.join('/forest/_actions', collection.name, String(actionIndex), slug),
      download: Boolean(schema.generateFile),
      isDynamicForm: !schema.staticForm,
      fields: await SchemaGeneratorActionsV2.buildFields(collection, name, schema),
    };
  }

  /** Build schema for given field */
  static buildFieldSchema(dataSource: DataSource, field: ActionField): ForestSchemaActionFieldV2 {
    const { label, description, isRequired, isReadOnly, type } = field;
    const output = { description, isRequired, isReadOnly } as Record<string, unknown>;

    output.name = label;
    output.value = ForestValueConverter.valueToForest(field, field.value);

    if (ActionFields.isCollectionField(field)) {
      const collection = dataSource.getCollection(field.collectionName);
      const [pk] = SchemaUtils.getPrimaryKeys(collection.schema);
      const pkSchema = collection.schema.fields[pk] as ColumnSchema;

      output.type = pkSchema.columnType;
      output.reference = `${collection.name}.${pk}`;
    } else if (type.endsWith('List')) {
      output.type = [type.substring(0, type.length - 4) as PrimitiveTypes];
    } else {
      output.type = type as unknown as PrimitiveTypes;
    }

    if (ActionFields.isEnumField(field) || ActionFields.isEnumListField(field)) {
      output.enumeration = field.enumValues;
    }

    output.widget = GeneratorActionFieldWidget.buildWidgetOptions(field);

    return output as ForestSchemaActionFieldV2;
  }

  private static async buildFields(
    collection: Collection,
    name: string,
    schema: ActionSchema,
  ): Promise<ForestSchemaActionFieldV2[]> {
    // We want the schema to be generated on usage => send dummy schema
    if (!schema.staticForm) {
      return [];
    }

    // Ask the action to generate a form
    const fields = await collection.getForm(null, name);

    if (fields) {
      // When sending to server, we need to rename 'value' into 'defaultValue'
      // otherwise, it does not gets applied 🤷‍♂️
      return fields.map(field => {
        const newField = SchemaGeneratorActionsV2.buildFieldSchema(collection.dataSource, field);
        newField.prefillValue = newField.value; // There is no defaultValue in field definition ??
        delete newField.value;

        return newField;
      });
    }

    return [];
  }
}
