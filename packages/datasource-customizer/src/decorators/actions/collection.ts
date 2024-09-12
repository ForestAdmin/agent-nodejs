import {
  ActionField,
  ActionFormElement,
  ActionResult,
  Caller,
  CollectionDecorator,
  CollectionSchema,
  DataSourceDecorator,
  Filter,
  GetFormMetas,
  PlainFilter,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import ActionContext from './context/base';
import ActionContextSingle from './context/single';
import ResultBuilder from './result-builder';
import { ActionBulk, ActionDefinition, ActionGlobal, ActionSingle } from './types/actions';
import {
  DynamicField,
  DynamicFormElement,
  Handler,
  SearchOptionsHandler,
  ValueOrHandler,
} from './types/fields';
import { TSchema } from '../../templates';

export default class ActionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<ActionCollectionDecorator>;

  private actions: Record<string, ActionDefinition> = {};

  addAction(name: string, action: ActionDefinition): void {
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
    metas?: GetFormMetas,
  ): Promise<ActionFormElement[]> {
    const action = this.actions[name];
    if (!action) return this.childCollection.getForm(caller, name, data, filter, metas);
    if (!action.form) return [];

    const formValues = data ? { ...data } : {};
    const used = new Set<string>();
    const context = this.getContext(caller, action, formValues, filter, used, metas?.changedField);

    // Convert DynamicField to ActionField in successive steps.
    let dynamicFields: DynamicFormElement[] = this.isHandler(action.form)
      ? await (action.form as (context: ActionContext<TSchema, string>) => DynamicFormElement[])(
          context,
        )
      : action.form.map(c => ({ ...c }));

    if (metas?.searchField) {
      // in the case of a search hook,
      // we don't want to rebuild all the fields. only the one searched
      dynamicFields = [
        dynamicFields.find(field => field.type !== 'Layout' && field.label === metas.searchField),
      ];
    }

    dynamicFields = await this.dropDefaults(context, dynamicFields, formValues);
    if (!metas?.includeHiddenFields) dynamicFields = await this.dropIfs(context, dynamicFields);

    const fields = await this.dropDeferred(context, metas?.searchValues, dynamicFields);

    for (const field of fields) {
      if (field.type !== 'Layout') {
        // customer did not define a handler to rewrite the previous value => reuse current one.
        if (field.value === undefined) field.value = formValues[field.label];

        // fields that were accessed through the context.formValues.X getter should be watched.
        field.watchChanges = used.has(field.label);
      }
    }

    return fields;
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const newSchema = { ...subSchema, actions: { ...subSchema.actions } };

    for (const [name, { form, scope, generateFile }] of Object.entries(this.actions)) {
      // An action form can be send in the schema to avoid calling the load handler
      // as long as there is nothing dynamic in it.
      const isDynamic =
        this.isHandler(form) ||
        form?.some(
          field =>
            field.type === 'Layout' ||
            Object.values(field).some(value => this.isHandler(value)) ||
            // A field with a hardcoded file should not be sent to the apimap. it is marked dynamic
            (field.type.includes('File') && field.defaultValue),
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
    changedField?: string,
  ): ActionContext {
    return new {
      Global: ActionContext,
      Bulk: ActionContext,
      Single: ActionContextSingle,
    }[action.scope](this, caller, formValues, filter as unknown as PlainFilter, used, changedField);
  }

  private async dropDefaults(
    context: ActionContext,
    fields: DynamicFormElement[],
    data: Record<string, unknown>,
  ): Promise<DynamicFormElement[]> {
    const promises = fields.map(async field => {
      if (field.type === 'Layout') return field;

      return this.dropDefault(context, field, data);
    });

    return Promise.all(promises);
  }

  private async dropDefault(
    context: ActionContext,
    field: DynamicField,
    data: Record<string, unknown>,
  ): Promise<DynamicField> {
    if (data[field.label] === undefined) {
      const defaultValue = await this.evaluate(context, null, field.defaultValue);
      data[field.label] = defaultValue;
    }

    delete field.defaultValue;

    return field;
  }

  private async dropIfs(
    context: ActionContext,
    fields: DynamicFormElement[],
  ): Promise<DynamicFormElement[]> {
    // Remove fields which have falsy if
    const ifValues = await Promise.all(
      fields.map(field => !field.if || this.evaluate(context, null, field.if)),
    );
    const newFields = fields.filter((_, index) => ifValues[index]);
    newFields.forEach(field => delete field.if);

    return newFields;
  }

  private async dropDeferred(
    context: ActionContext,
    searchValues: Record<string, string | null> | null,
    fields: DynamicFormElement[],
  ): Promise<ActionFormElement[]> {
    const newFields = fields.map(async (field): Promise<ActionFormElement> => {
      const keys = Object.keys(field);
      const values = await Promise.all(
        Object.values(field).map(value => {
          const searchValue = field.type === 'Layout' ? null : searchValues?.[field.label];

          return this.evaluate(context, searchValue, value);
        }),
      );

      return keys.reduce<ActionField>(
        (memo, key, index) => ({ ...memo, [key]: values[index] }),
        {} as ActionField,
      );
    });

    return Promise.all(newFields);
  }

  private async evaluate<T>(
    context: ActionContext,
    searchValue: string | null,
    value: ValueOrHandler<ActionContext, T> | SearchOptionsHandler<ActionContext, T>,
  ) {
    if (this.isHandler(value)) {
      // Only the options key of the dynamic search dropdown widget accept a searchValue
      if (this.isSearchOptionsHandler<T>(value)) {
        return value(context, searchValue);
      }

      return value(context);
    }

    return value;
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private isHandler(value: ValueOrHandler): value is Function {
    return typeof value === 'function';
  }

  private isSearchOptionsHandler<T>(
    value: Handler<ActionContext, T> | SearchOptionsHandler<ActionContext, T>,
  ): value is SearchOptionsHandler<ActionContext, T> {
    return value.name === 'options';
  }
}
