import { ForestServerActionFormLayoutElement } from '@forestadmin/forestadmin-client';

import ActionFieldMultipleChoice from './action-field-multiple-choice';
import FieldGetter from './field-getter';
import { PlainField, ResponseBody } from './types';
import HttpRequester from '../http-requester';

export default class FieldFormStates<TypingsSchema> {
  private readonly fields: FieldGetter[];
  private readonly actionName: string;
  private readonly actionPath: string;
  private readonly collectionName: keyof TypingsSchema;
  private readonly httpRequester: HttpRequester;
  private readonly ids: string[];
  private readonly layout: ForestServerActionFormLayoutElement[];

  constructor(
    actionName: string,
    actionPath: string,
    collectionName: keyof TypingsSchema,
    httpRequester: HttpRequester,
    ids: string[],
  ) {
    this.fields = [];
    this.actionName = actionName;
    this.actionPath = actionPath;
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.ids = ids;
    this.layout = [];
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
    await this.loadChanges(name);
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

    const queryResults = await this.httpRequester.query<ResponseBody>({
      method: 'post',
      path: `${this.actionPath}/hooks/load`,
      body: requestBody,
    });

    this.clearFieldsAndLayout();
    this.layout.push(...queryResults.layout);
    this.addFields(queryResults.fields);
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
