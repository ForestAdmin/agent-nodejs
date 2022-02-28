import { Action, ActionBulk, ActionGlobal, ActionSingle } from './types/actions';
import { ActionField, ActionResult, ActionResultType } from '../../interfaces/action';
import { ActionScope, CollectionSchema } from '../../interfaces/schema';
import { DynamicField, ValueOrHandler } from './types/fields';
import { RecordData } from '../../interfaces/record';
import ActionContext from './context/base';
import ActionContextBulk from './context/bulk';
import ActionContextSingle from './context/single';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import ResponseBuilder from './response-builder';

export default class ActionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ActionCollectionDecorator>;

  private actions: Record<string, Action> = {};

  registerAction(name: string, action: Action): void {
    this.actions[name] = action;
  }

  override async execute(name: string, data: RecordData, filter: Filter): Promise<ActionResult> {
    const action = this.actions[name];
    if (!action) return this.childCollection.execute(name, data, filter);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = this.getContext(action, data, filter) as any;
    const responseBuilder = new ResponseBuilder();
    const result = await action.execute(context, responseBuilder);

    return (
      result || {
        type: ActionResultType.Success as const,
        invalidated: new Set<string>(),
        format: 'text' as const,
        message: 'Success',
      }
    );
  }

  override async getForm(name: string, data?: RecordData, filter?: Filter): Promise<ActionField[]> {
    const action = this.actions[name];
    if (!action) return this.childCollection.getForm(name, data, filter);
    if (!action.form) return [];

    const formValues = data ? { ...data } : {};
    const used = new Set<string>();
    const context = this.getContext(action, formValues, filter, used);

    // Convert DynamicField to ActionField in successive steps.
    let dynamicFields: DynamicField[];
    dynamicFields = action.form.map(c => ({ ...c }));
    dynamicFields = await this.dropDefaults(context, dynamicFields, !data, formValues);
    dynamicFields = await this.dropIfs(context, dynamicFields);

    const fields = await this.dropDeferred(context, dynamicFields);

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
        Object.values(field).some(value => typeof value === 'function'),
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
    if (action.scope === ActionScope.Global) {
      return new ActionContext(this, formValues, filter, used);
    }

    return action.scope === ActionScope.Single
      ? new ActionContextSingle(this, formValues, filter, used)
      : new ActionContextBulk(this, formValues, filter, used);
  }

  private async dropDefaults(
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

  private async dropIfs(context: ActionContext, fields: DynamicField[]): Promise<DynamicField[]> {
    // Remove fields which have falsy if
    const ifValues = await Promise.all(
      fields.map(field => !field.if || this.evaluate(context, field.if)),
    );
    const newFields = fields.filter((_, index) => ifValues[index]);
    newFields.forEach(field => delete field.if);

    return newFields;
  }

  private async dropDeferred(
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
