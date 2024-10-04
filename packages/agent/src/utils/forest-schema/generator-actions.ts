import {
  ActionField,
  ActionFormElement,
  ActionLayoutElement,
  Collection,
  DataSource,
  LayoutElementInput,
  PrimitiveTypes,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import {
  ForestServerAction,
  ForestServerActionField,
  ForestServerActionFormElementFieldReference,
  ForestServerActionFormLayoutElement,
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
      label: 'Loading...',
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
    let fields = SchemaGeneratorActions.defaultFields;

    if (schema.staticForm) {
      const rawForm = await collection.getForm(null, name, null, null);
      fields = SchemaGeneratorActions.buildFieldsAndLayout(collection.dataSource, rawForm).fields;

      SchemaGeneratorActions.setFieldsDefaultValue(fields);
    }

    if (schema.submitButtonLabel?.length > 50) {
      throw new Error('Submit button label must have less than 50 characters');
    }

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
      description: schema.description,
      submitButtonLabel: schema.submitButtonLabel,
      hooks: {
        load: !schema.staticForm,
        // Always registering the change hook has no consequences, even if we don't use it.
        change: ['changeHook'],
      },
    };
  }

  static buildFieldsAndLayout(dataSource: DataSource, form: ActionFormElement[]) {
    const { fields, layout } = SchemaGeneratorActions.extractFieldsAndLayout(form);

    return {
      fields: fields.map(field => SchemaGeneratorActions.buildFieldSchema(dataSource, field)),
      layout: layout.map(layoutElement => SchemaGeneratorActions.buildLayoutSchema(layoutElement)),
    };
  }

  static setFieldsDefaultValue(fields: ForestServerActionField[]) {
    fields.forEach(field => {
      field.defaultValue = field.value;
      delete field.value;
    });
  }

  /** Build schema for given field */
  static buildFieldSchema(dataSource: DataSource, field: ActionField): ForestServerActionField {
    const { id, label, description, isRequired, isReadOnly, watchChanges, type } = field;
    const output = { field: id, label, description, isRequired, isReadOnly } as Record<
      string,
      unknown
    >;

    output.value = ForestValueConverter.valueToForest(field, field.value);

    if (watchChanges) output.hook = 'changeHook';

    if (ActionFields.isCollectionField(field)) {
      const collection = dataSource.getCollection(field.collectionName);
      const [pk] = SchemaUtils.getPrimaryKeys(collection.schema);
      const pkSchema = SchemaUtils.getColumn(collection.schema, pk, collection.name);

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

    return output as ForestServerActionField;
  }

  static buildLayoutSchema(
    element: ActionLayoutElement,
    options?: { forceInput?: boolean },
  ): ForestServerActionFormLayoutElement {
    if (options?.forceInput) {
      element.component = 'Input';
    }

    switch (element.component) {
      case 'Input':
        return {
          component: 'input',
          fieldId: element.fieldId,
        };
      case 'HtmlBlock':
        return {
          component: 'htmlBlock',
          content: element.content,
        };
      case 'Row':
        return {
          component: 'row',
          fields: element.fields.map(
            field =>
              SchemaGeneratorActions.buildLayoutSchema(field, {
                forceInput: true,
              }) as ForestServerActionFormElementFieldReference,
          ),
        };
      case 'Separator':
      default:
        return {
          component: 'separator',
        };
    }
  }

  static extractFieldsAndLayout(formElements: ActionFormElement[]): {
    fields: ActionField[];
    layout: ActionLayoutElement[];
  } {
    let hasLayout = false;
    const fields: ActionField[] = [];
    let layout: ActionLayoutElement[] = [];

    if (!formElements) return { fields: [], layout: [] };

    formElements.forEach(element => {
      if (element.type === 'Layout') {
        hasLayout = true;
      }

      layout.push(SchemaGeneratorActions.parseLayout(element, fields));
    });

    if (!hasLayout) {
      layout = [];
    }

    return { fields, layout };
  }

  private static parseLayout(
    element: ActionFormElement,
    allFields: ActionField[],
  ): ActionLayoutElement {
    if (element.type === 'Layout') {
      if (element.component === 'Row') {
        const fields = element.fields.map(
          field => SchemaGeneratorActions.parseLayout(field, allFields) as LayoutElementInput,
        );

        return {
          type: 'Layout',
          component: 'Row',
          fields,
        };
      }

      return element;
    }

    allFields.push(element);

    return {
      type: 'Layout',
      component: 'Input',
      fieldId: element.id,
    };
  }
}
