import {
  ActionField,
  ActionInputField,
  ActionLayoutElementOrPage,
  ActionSchema,
  Collection,
  ColumnSchema,
  DataSource,
  PrimitiveTypes,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import {
  ForestServerAction,
  ForestServerActionField,
  ForestServerActionFieldOrLayoutElement,
  ForestServerActionInputField,
  ForestServerActionLayoutElementOrPage,
} from '@forestadmin/forestadmin-client';
import path from 'path';

import ActionFields from './action-fields';
import ForestValueConverter from './action-values';
import GeneratorActionFieldWidget from './generator-action-field-widget';

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
      widgetEdit: null,
    },
  ];

  static getActionSlug(name: string) {
    return name.toLocaleLowerCase().replace(/[^a-z0-9-]+/g, '-');
  }

  static async buildSchema(collection: Collection, name: string): Promise<ForestServerAction> {
    const schema = collection.schema.actions[name];

    const actionIndex = Object.keys(collection.schema.actions).indexOf(name);

    // Generate url-safe friendly name (which won't be unique, but that's OK).
    const slug = SchemaGeneratorActions.getActionSlug(name);
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

  static buildFieldSchema(dataSource: DataSource, field: ActionField): ForestServerActionField {
    if (field.type === 'Layout') return this.buildLayoutElementSchema(dataSource, field);

    return this.buildInputFieldSchema(dataSource, field);
  }

  /** Build schema for given field */
  static buildInputFieldSchema(
    dataSource: DataSource,
    field: ActionInputField,
  ): ForestServerActionInputField {
    const { label, description, isRequired, isReadOnly, watchChanges, type } = field;
    const output = { description, isRequired, isReadOnly } as Record<string, unknown>;

    output.field = label;
    output.value = ForestValueConverter.valueToForest(field, field.value);

    if (watchChanges) output.hook = 'changeHook';

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
      output.enums = field.enumValues;
    }

    output.widgetEdit = GeneratorActionFieldWidget.buildWidgetOptions(field);

    return output as ForestServerActionInputField;
  }

  static buildLayoutElementSchema(
    dataSource: DataSource,
    field: ActionLayoutElementOrPage,
  ): ForestServerActionLayoutElementOrPage {
    const { watchChanges, type } = field;
    const output = { type } as Record<string, unknown>;
    let hook: string;

    if (watchChanges) hook = 'changeHook';

    switch (field.widget) {
      case 'Label':
        return {
          type: field.type,
          layoutWidget: {
            name: 'label',
            parameters: {
              content: field.content,
            },
          },
          hook,
        };
      case 'Separator':
        return {
          type: field.type,
          layoutWidget: {
            name: 'separator',
          },
          hook,
        };
      case 'Row':
        return {
          type: field.type,
          layoutWidget: {
            name: 'row',
            parameters: {
              fields: [
                this.buildInputFieldSchema(dataSource, field.fields[0] as ActionInputField),
                this.buildInputFieldSchema(dataSource, field.fields[1] as ActionInputField),
              ],
            },
          },
          hook,
        };
      case 'Page':
        return {
          type: field.type,
          layoutWidget: {
            name: 'page',
            parameters: {
              backButtonLabel: field.backButtonLabel,
              nextButtonLabel: field.nextButtonLabel,
              elements: field.elements.map(
                element =>
                  this.buildFieldSchema(
                    dataSource,
                    element,
                  ) as ForestServerActionFieldOrLayoutElement,
              ),
            },
          },
          hook,
        };
      default:
    }

    output.layoutWidget = GeneratorActionFieldWidget.buildWidgetOptions(field);

    return output as ForestServerActionLayoutElementOrPage;
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

        if (newField.type !== 'Layout') {
          newField.defaultValue = newField.value;
          delete newField.value;
        }

        return newField;
      });
    }

    return [];
  }
}
