import { Action, ActionBulk, ActionGlobal, ActionSingle } from './types/actions';
import { ActionField, ActionResponse, ActionResponseType } from '../../interfaces/action';
import { ActionSchemaScope, CollectionSchema } from '../../interfaces/schema';
import { DynamicField, ValueOrHandler } from './types/fields';
import { RecordData } from '../../interfaces/record';
import ActionContext from './context/base';
import ActionContextBulk from './context/bulk';
import ActionContextSingle from './context/single';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import Projection from '../../interfaces/query/projection';
import ResponseBuilder from './response-builder';

export default class ActionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ActionCollectionDecorator>;

  private actions: Record<string, Action> = {};

  registerAction(name: string, action: Action): void {
    this.actions[name] = action;
  }

  override async execute(name: string, data: RecordData, filter: Filter): Promise<ActionResponse> {
    const action = this.actions[name];
    if (!action) return this.childCollection.execute(name, data, filter);

    const response = {
      type: ActionResponseType.Success as const,
      invalidated: new Set<string>(),
      format: 'text' as const,
      message: 'Success',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = this.getContext(action, data, filter) as any;
    const responseBuilder = new ResponseBuilder(response);

    await action.execute(context, responseBuilder);

    return response;
  }

  override async getForm(name: string, data?: RecordData, filter?: Filter): Promise<ActionField[]> {
    const action = this.actions[name];
    if (!action) return this.childCollection.getForm(name, data, filter);
    if (!action.form) return [];

    const formValues = data ? { ...data } : {};
    const used = new Set<string>();
    const context = this.getContext(action, formValues, filter, used);

    // Convert DynamicField to ActionField in successive steps.
    let conditionalFields: DynamicField[];
    conditionalFields = action.form.map(c => ({ ...c }));
    conditionalFields = await this.withDefaults(context, conditionalFields, !data, formValues);
    conditionalFields = await this.withIfs(context, conditionalFields);

    const fields = await this.withDeferred(context, conditionalFields);

    for (const field of fields) {
      // customer did not define a handler to rewrite the previous value => reuse current one.
      if (field.value === undefined) field.value = formValues[field.label];

      // fields that were accessed through the context.formValues.X getter should be watched.
      field.watchChanges = used.has(field.label);
    }

    return fields;
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const newSchema = { ...subSchema, actions: { ...subSchema.actions } };

    for (const [name, { form, scope, generateFile }] of Object.entries(this.actions)) {
      // An action form can be send in the schema to avoid calling the load handler
      // as long as there is nothing dynamic in it.
      const isDynamic = form?.some(field =>
        Object.values(field).every(value => typeof value === 'function'),
      );

      newSchema.actions[name] = { scope, generateFile, staticForm: !isDynamic };
    }

    return newSchema;
  }

  private getContext(
    action: ActionSingle | ActionBulk | ActionGlobal,
    formValues: RecordData,
    filter: Filter,
    used?: Set<string>,
  ): ActionContext {
    if (action.scope === ActionSchemaScope.Global) {
      return new ActionContext(this, formValues, used);
    }

    const dependencies = new Projection(...action.dependencies);

    return action.scope === ActionSchemaScope.Single
      ? new ActionContextSingle(this, formValues, used, dependencies, filter)
      : new ActionContextBulk(this, formValues, used, dependencies, filter);
  }

  private async withDefaults(
    context: ActionContext,
    fields: DynamicField[],
    isFirstCall: boolean,
    data: Record<string, unknown>,
  ): Promise<DynamicField[]> {
    if (isFirstCall) {
      const defaults = await Promise.all(
        fields.map(field => this.evaluate(context, field.defaultValue)),
      );

      fields.forEach((field, index) => {
        data[field.label] = defaults[index];
      });
    }

    fields.forEach(field => delete field.defaultValue);

    return fields;
  }

  private async withIfs(context: ActionContext, fields: DynamicField[]): Promise<DynamicField[]> {
    // Remove fields which have falsy if
    const ifValues = await Promise.all(fields.map(field => this.evaluate(context, field.if)));
    const newFields = fields.filter((_, index) => ifValues[index] === undefined || ifValues[index]);
    newFields.forEach(field => delete field.if);

    return newFields;
  }

  private async withDeferred(
    context: ActionContext,
    fields: DynamicField[],
  ): Promise<ActionField[]> {
    const newFields = fields.map(async (field): Promise<ActionField> => {
      const keys = Object.keys(field);
      const values = await Promise.all(
        Object.values(field).map(value => this.evaluate(context, value)),
      );

      return keys.reduce<ActionField>(
        (memo, key, index) => ({ ...memo, [key]: values[index] }),
        {} as ActionField,
      );
    });

    return Promise.all(newFields);
  }

  private async evaluate<T>(context: ActionContext, value: ValueOrHandler): Promise<T> {
    return typeof value === 'function' ? value(context) : value;
  }
}
