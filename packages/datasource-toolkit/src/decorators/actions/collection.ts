import { Action, ActionBulk, ActionGlobal, ActionSingle } from './types/actions';
import { ActionField, ActionResult } from '../../interfaces/action';
import { Caller } from '../../interfaces/caller';
import { CollectionSchema } from '../../interfaces/schema';
import { DynamicField, ValueOrHandler } from './types/fields';
import { RecordData } from '../../interfaces/record';
import ActionContext from './context/base';
import ActionContextSingle from './context/single';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import Filter, { PlainFilter } from '../../interfaces/query/filter/unpaginated';
import ResultBuilder from './result-builder';

export default class ActionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ActionCollectionDecorator>;

  private actions: Record<string, Action> = {};

  addAction(name: string, action: Action): void {
    this.actions[name] = action;
    this.markSchemaAsDirty();
  }

  override async execute(
    caller: Caller,
    name: string,
    data: RecordData,
    filter: Filter,
  ): Promise<ActionResult> {
    const action = this.actions[name];
    if (!action) return this.childCollection.execute(caller, name, data, filter);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = this.getContext(caller, action, data, filter) as any;
    const resultBuilder = new ResultBuilder();
    const result = await action.execute(context, resultBuilder);

    return (
      result || {
        type: 'Success' as const,
        invalidated: new Set<string>(),
        message: 'Success',
      }
    );
  }

  override async getForm(
    caller: Caller,
    name: string,
    data?: RecordData,
    filter?: Filter,
  ): Promise<ActionField[]> {
    const action = this.actions[name];
    if (!action) return this.childCollection.getForm(caller, name, data, filter);
    if (!action.form) return [];

    const formValues = data ? { ...data } : {};
    const used = new Set<string>();
    const context = this.getContext(caller, action, formValues, filter, used);

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

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const newSchema = { ...subSchema, actions: { ...subSchema.actions } };

    for (const [name, { form, scope, generateFile }] of Object.entries(this.actions)) {
      // An action form can be send in the schema to avoid calling the load handler
      // as long as there is nothing dynamic in it.
      const isDynamic = form?.some(field =>
        Object.values(field).some(value => typeof value === 'function'),
      );

      newSchema.actions[name] = { scope, generateFile: !!generateFile, staticForm: !isDynamic };
    }

    return newSchema;
  }

  private getContext(
    caller: Caller,
    action: ActionSingle | ActionBulk | ActionGlobal,
    formValues: RecordData,
    filter: Filter,
    used?: Set<string>,
  ): ActionContext {
    return new {
      Global: ActionContext,
      Bulk: ActionContext,
      Single: ActionContextSingle,
    }[action.scope](this, caller, formValues, filter as unknown as PlainFilter, used);
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
