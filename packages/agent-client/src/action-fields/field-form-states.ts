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

  constructor(
    actionName: string,
    actionPath: string,
    collectionName: string,
    httpRequester: HttpRequester,
    ids: string[],
    hooks?: ForestSchemaAction['hooks'],
    fallbackFields?: ForestSchemaAction['fields'],
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

    if (!this.hooks || this.hooks.change.length > 0) {
      await this.loadChanges(name);
    }
  }

  async loadInitialState(): Promise<void> {
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
      // When hooks.load is false, the behavior differs between backends:
      //
      // - Node agent (@forestadmin/agent): always responds to POST /hooks/load
      //   with the form fields, even when hooks.load is false in the schema.
      //   In this case the call above succeeds and fields are loaded normally.
      //
      // - Ruby agent (forest_liana): does NOT register a route for /hooks/load
      //   when hooks.load is false. The POST returns a 404.
      //   In this case we catch the 404 and continue with an empty form,
      //   which matches the expected behavior (no dynamic fields to load).
      //
      // We always attempt the call so Node users get their fields,
      // and only swallow 404 errors for Ruby users. Other errors (401, 500,
      // network failures) are rethrown so they surface properly.
      if (this.hooks && !this.hooks.load && HttpRequester.is404Error(error)) {
        this.clearFieldsAndLayout();

        if (this.fallbackFields?.length) {
          this.addFields(
            this.fallbackFields.map(f => ({
              field: f.field,
              type: f.type,
              isRequired: f.isRequired ?? false,
              isReadOnly: false,
              value: f.defaultValue,
            })),
          );
        }

        return;
      }

      throw error;
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
    this.layout.push(...queryResults.layout);
  }
}
