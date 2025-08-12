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
import { AgentOptionsWithDefaults } from '../../types';

export default class SchemaGeneratorActions {
  private readonly useUnsafeActionEndpoint: boolean;

  constructor(options: AgentOptionsWithDefaults) {
    this.useUnsafeActionEndpoint = options.useUnsafeActionEndpoint;
  }

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

  async buildSchema(collection: Collection, name: string): Promise<ForestServerAction> {
    const schema = collection.schema.actions[name];

    // Generate url-safe friendly name (which won't be unique, but that's OK).
    const slug = SchemaGeneratorActions.getActionSlug(name);
    let fields = SchemaGeneratorActions.defaultFields;
    let layout;

    if (schema.staticForm) {
      const rawForm = await collection.getForm(null, name, null, null);
      const fieldsAndLayout = SchemaGeneratorActions.buildFieldsAndLayout(
        collection.dataSource,
        rawForm,
      );
      layout = fieldsAndLayout.layout.length ? { layout: fieldsAndLayout.layout } : {};
      fields = fieldsAndLayout.fields;

      SchemaGeneratorActions.setFieldsDefaultValue(fields);
    }

    if (schema.submitButtonLabel?.length > 50) {
      throw new Error('Submit button label must have less than 50 characters');
    }

    let id = `${collection.name}-`;
    const endpointPaths = ['/forest/_actions', collection.name];

    if (!this.useUnsafeActionEndpoint) {
      const actionIndex = Object.keys(collection.schema.actions).indexOf(name);
      id += `${actionIndex}-`;
      endpointPaths.push(String(actionIndex));
    }

    id += slug;
    endpointPaths.push(slug);

    return {
      id,
      name,
      type: schema.scope.toLowerCase() as 'single' | 'bulk' | 'global',
      baseUrl: null,
      endpoint: path.posix.join(...endpointPaths),
      httpMethod: 'POST',
      redirect: null, // frontend ignores this attribute
      download: Boolean(schema.generateFile),
      fields,
      ...layout,
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

  static buildLayoutSchema(element: ActionLayoutElement): ForestServerActionFormLayoutElement {
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
              SchemaGeneratorActions.buildLayoutSchema(
                field,
              ) as ForestServerActionFormElementFieldReference,
          ),
        };
      case 'Page':
        return {
          component: 'page',
          nextButtonLabel: element.nextButtonLabel,
          previousButtonLabel: element.previousButtonLabel,
          elements: element.elements.map(
            subElement =>
              SchemaGeneratorActions.buildLayoutSchema(
                subElement,
              ) as ForestServerActionFormLayoutElement,
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
      const subElementsKey = {
        Row: 'fields',
        Page: 'elements',
      };

      if (element.component === 'Row' || element.component === 'Page') {
        const key = subElementsKey[element.component];
        const subElements = element[key].map(
          field => SchemaGeneratorActions.parseLayout(field, allFields) as LayoutElementInput,
        );

        return {
          ...element,
          [key]: subElements,
        } as ActionLayoutElement;
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
