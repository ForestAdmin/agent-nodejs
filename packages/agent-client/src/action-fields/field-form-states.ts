import type { PlainField, ResponseBody } from './types';
import type {
  ForestSchemaAction,
  ForestServerActionFormLayoutElement,
} from '@forestadmin/forestadmin-client';

import HttpRequester from '../http-requester';
import ActionFieldMultipleChoice from './action-field-multiple-choice';
import FieldGetter from './field-getter';

export default class FieldFormStates {
  private readonly fields: FieldGetter[];
  private readonly actionName: string;
  private readonly actionPath: string;
  private readonly collectionName: string;
  private readonly httpRequester: HttpRequester;
  private readonly ids: string[];
  private readonly layout: ForestServerActionFormLayoutElement[];
  private readonly hooks?: ForestSchemaAction['hooks'];
  private readonly fallbackFields?: ForestSchemaAction['fields'];
  private readonly fallbackLayout?: ForestSchemaAction['layout'];

  constructor(
    actionName: string,
    actionPath: string,
    collectionName: string,
    httpRequester: HttpRequester,
    ids: string[],
    hooks?: ForestSchemaAction['hooks'],
    fallbackFields?: ForestSchemaAction['fields'],
    fallbackLayout?: ForestSchemaAction['layout'],
  ) {
    this.fields = [];
    this.actionName = actionName;
    this.actionPath = actionPath;
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.ids = ids;
    this.layout = [];
    this.hooks = hooks;
    this.fallbackFields = fallbackFields;
    this.fallbackLayout = fallbackLayout;
  }

  getFieldValues(): Record<string, unknown> {
    return this.fields.reduce((acc, f) => {
      if (f.getValue() !== undefined) acc[f.getName()] = f.getValue();

      return acc;
    }, {});
  }

  getMultipleChoiceField(name: string): ActionFieldMultipleChoice {
    return new ActionFieldMultipleChoice(this.getField(name)?.getPlainField());
  }

  getField(name: string): FieldGetter | undefined {
    return this.fields.find(f => f.getName() === name);
  }

  getFields(): FieldGetter[] {
    return this.fields;
  }

  getLayout(): ForestServerActionFormLayoutElement[] {
    return this.layout;
  }

  async setFieldValue(name: string, value: unknown): Promise<void> {
    const field = this.getField(name);
    if (!field) throw new Error(`Field "${name}" not found in action "${this.actionName}"`);

    field.getPlainField().value = value;

    const fieldHasHook = field.getPlainField().hook;

    // Only fields that declare a change hook trigger a /hooks/change request.
    if (fieldHasHook) {
      await this.loadChanges(name);
    }
  }

  async loadInitialState(): Promise<void> {
    // hooks.load: false means the form is static: the schema already carries the complete form
    // (fields with materialized defaults, and layout when any), so the request could only return
    // the same data — and forest_liana agents < 9.20.1 don't even expose the route (404 noise in
    // customers' metrics). Only probe when the schema gave us no fields to fall back on.
    if (this.hooks && !this.hooks.load && this.fallbackFields) {
      this.applyFallbackForm();

      return;
    }

    const requestBody = {
      data: {
        attributes: {
          collection_name: this.collectionName,
          ids: this.ids,
          values: {},
        },
        type: 'action-requests',
      },
    };

    try {
      const queryResults = await this.httpRequester.query<ResponseBody>({
        method: 'post',
        path: `${this.actionPath}/hooks/load`,
        body: requestBody,
      });

      this.clearFieldsAndLayout();
      this.layout.push(...(queryResults.layout ?? []));
      this.addFields(queryResults.fields);
    } catch (error) {
      // Reached only when the schema provided no fallback fields for a static form: probe the
      // agent anyway (Node agents answer with the form), and swallow the forest_liana < 9.20.1
      // 404 as "no dynamic fields to load". Other errors (401, 500, network) surface properly.
      if (this.hooks && !this.hooks.load && HttpRequester.is404Error(error)) {
        this.applyFallbackForm();

        return;
      }

      throw error;
    }
  }

  private applyFallbackForm(): void {
    this.clearFieldsAndLayout();
    this.layout.push(...(this.fallbackLayout ?? []));

    if (this.fallbackFields?.length) {
      this.addFields(
        this.fallbackFields.map(f => ({
          field: f.field,
          type: f.type,
          isRequired: f.isRequired ?? false,
          isReadOnly: false,
          value: f.defaultValue,
          hook: f.hook,
        })),
      );
    }
  }

  private addFields(plainFields: PlainField[]): void {
    plainFields.forEach(f => this.fields.push(new FieldGetter(f)));
  }

  private clearFieldsAndLayout(): void {
    this.layout.splice(0, this.layout.length);
    this.fields.splice(0, this.fields.length);
  }

  private async loadChanges(fieldName: string): Promise<void> {
    const requestBody = {
      data: {
        attributes: {
          collection_name: this.collectionName,
          changed_field: fieldName,
          ids: this.ids,
          fields: this.fields.map(f => f.getPlainField()),
        },
        type: 'custom-action-hook-requests',
      },
    };

    const queryResults = await this.httpRequester.query<ResponseBody>({
      method: 'post',
      path: `${this.actionPath}/hooks/change`,
      body: requestBody,
    });

    this.clearFieldsAndLayout();
    this.addFields(queryResults.fields);
    this.layout.push(...(queryResults.layout ?? []));
  }
}
