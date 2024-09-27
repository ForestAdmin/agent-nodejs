import {
  ActionFormElement,
  ActionResult,
  Caller,
  CollectionDecorator,
  CollectionSchema,
  DataSourceDecorator,
  Filter,
  GetFormMetas,
  LayoutElementPageWithField,
  PlainFilter,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import ActionContext from './context/base';
import ActionContextSingle from './context/single';
import ResultBuilder from './result-builder';
import { ActionBulk, ActionDefinition, ActionGlobal, ActionSingle } from './types/actions';
import {
  DynamicField,
  DynamicForm,
  DynamicFormElementOrPage,
  Handler,
  SearchOptionsHandler,
  ValueOrHandler,
} from './types/fields';
import { TSchema } from '../../templates';

type DynamicFieldWithId<Context = unknown> = DynamicField<Context> & { id: string };

type DynamicFormElementWithId<Context = unknown> = DynamicFormElementOrPage<
  Context,
  DynamicFieldWithId<Context>
>;

type GenericFormElement = DynamicFormElementOrPage | ActionFormElement;

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
    let dynamicFields: DynamicForm = this.isHandler(action.form)
      ? await (action.form as (context: ActionContext<TSchema, string>) => DynamicForm)(context)
      : // copy fields to keep original object unchanged
        await this.copyFields(action.form);

    this.ensureFormIsCorrect(dynamicFields);

    if (metas?.searchField) {
      // in the case of a search hook,
      // we don't want to rebuild all the fields. only the one searched
      dynamicFields = [
        dynamicFields.find(field => field.type === 'Layout' || field.label === metas.searchField),
      ] as DynamicForm;
    }

    let dynamicFieldsWithId = await this.dropDefaultsAndSetId(context, dynamicFields, formValues);

    if (!metas?.includeHiddenFields) {
      dynamicFieldsWithId = await this.dropIfs(context, dynamicFieldsWithId);
    }

    const fields = await this.dropDeferred(context, metas?.searchValues, dynamicFieldsWithId);

    this.setWatchChangesOnFields(formValues, used, fields);

    return fields;
  }

  private ensureFormIsCorrect(form: DynamicForm) {
    const multiPages = form[0]?.type === 'Layout' && form[0]?.component === 'Page';

    form.forEach(element => {
      const elementIsPage = element.type === 'Layout' && element.component === 'Page';

      if (multiPages && !elementIsPage) {
        throw new Error('Multipages forms can only have pages as root elements of the form array');
      }

      if (!multiPages && elementIsPage) {
        throw new Error('Single page forms cannot have pages as root elements of the form array');
      }
    });
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const newSchema = { ...subSchema, actions: { ...subSchema.actions } };

    for (const [
      name,
      { form, scope, generateFile, description, submitButtonLabel },
    ] of Object.entries(this.actions)) {
      // An action form can be send in the schema to avoid calling the load handler
      // as long as there is nothing dynamic in it
      const isDynamic =
        this.isHandler(form) ||
        form?.some(
          field =>
            field.type === 'Layout' || // all forms containing some layout elements are handled as dynamic
            Object.values(field).some(value => this.isHandler(value)) ||
            // A field with a hardcoded file should not be sent to the apimap. it is marked dynamic
            (field.type.includes('File') && field.defaultValue),
        );

      newSchema.actions[name] = {
        scope,
        generateFile: !!generateFile,
        staticForm: !isDynamic,
        description,
        submitButtonLabel,
      };
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

  private getSubElementsAttributeKey<T extends GenericFormElement>(field: T): string | null {
    if (field.type === 'Layout' && field.component === 'Row') return 'fields';
    if (field.type === 'Layout' && field.component === 'Page') return 'elements';

    return null;
  }

  private async executeOnSubFields<
    Result extends GenericFormElement,
    Input extends GenericFormElement,
  >(field: Input, handler: (subFields: Input[]) => Result[] | Promise<Result[]>) {
    const subElementsKey = this.getSubElementsAttributeKey(field);
    if (!subElementsKey) return;
    field[subElementsKey] = await handler(field[subElementsKey] || []);
  }

  private async copyFields(fields: DynamicFormElementOrPage[]) {
    return Promise.all(
      fields.map(async field => {
        const fieldCopy: DynamicFormElementOrPage = { ...field };

        await this.executeOnSubFields(field, subFields => this.copyFields(subFields));

        return fieldCopy;
      }),
    );
  }

  private async dropDefaultsAndSetId(
    context: ActionContext,
    fields: DynamicFormElementOrPage[],
    data: Record<string, unknown>,
  ): Promise<DynamicFormElementWithId[]> {
    const promises = fields.map(async field => {
      if (field.type !== 'Layout') {
        field.id = field.id || field.label;

        return this.dropDefault(context, field as DynamicFieldWithId, data);
      }

      await this.executeOnSubFields(field, subfields =>
        this.dropDefaultsAndSetId(context, subfields, data),
      );

      return field as DynamicFormElementWithId;
    });

    return Promise.all(promises);
  }

  private async dropDefault(
    context: ActionContext,
    field: DynamicFieldWithId,
    data: Record<string, unknown>,
  ): Promise<DynamicFieldWithId> {
    if (data[field.id] === undefined) {
      const defaultValue = await this.evaluate(context, null, field.defaultValue);
      data[field.id] = defaultValue;
    }

    delete field.defaultValue;

    return field;
  }

  private async dropIfs(
    context: ActionContext,
    fields: DynamicFormElementWithId[],
  ): Promise<DynamicFormElementWithId[]> {
    // Remove fields which have falsy if
    const ifValues = await Promise.all(
      fields.map(async field => {
        if ((await this.evaluate(context, null, field.if)) === false) {
          // drop element if condition returns false
          return false;
        }

        const subElementsKey = this.getSubElementsAttributeKey(field);

        if (subElementsKey) {
          field[subElementsKey] = await this.dropIfs(context, field[subElementsKey] || []);

          // drop element if no subElement
          if (field[subElementsKey].length === 0) {
            return false;
          }
        }

        return true;
      }),
    );

    const newFields = fields.filter((_, index) => ifValues[index]);
    newFields.forEach(field => delete field.if);

    return newFields;
  }

  private async dropDeferred(
    context: ActionContext,
    searchValues: Record<string, string | null> | null,
    fields: DynamicFormElementWithId[],
  ): Promise<ActionFormElement[]> {
    const newFields = fields.map(
      async (field): Promise<ActionFormElement | LayoutElementPageWithField> => {
        await this.executeOnSubFields(field, subfields =>
          this.dropDeferred(context, searchValues, subfields),
        );

        const keys = Object.keys(field);
        const values = await Promise.all(
          Object.values(field).map(value => {
            const searchValue = field.type === 'Layout' ? null : searchValues?.[field.id];

            return this.evaluate(context, searchValue, value);
          }),
        );

        return keys.reduce<ActionFormElement>(
          (memo, key, index) => ({ ...memo, [key]: values[index] }),
          {} as ActionFormElement,
        );
      },
    );

    return Promise.all(newFields);
  }

  private async setWatchChangesOnFields(
    formValues: {
      [x: string]: unknown;
    },
    used: Set<string>,
    fields: ActionFormElement[],
  ) {
    return Promise.all(
      fields.map(async field => {
        if (field.type !== 'Layout') {
          return this.setWatchChangesOnField(formValues, used, field);
        }

        await this.executeOnSubFields(field, subfields =>
          this.setWatchChangesOnFields(formValues, used, subfields),
        );

        return field;
      }),
    );
  }

  private setWatchChangesOnField(
    formValues: {
      [x: string]: unknown;
    },
    used: Set<string>,
    field: ActionFormElement,
  ) {
    if (field.type !== 'Layout') {
      // customer did not define a handler to rewrite the previous value => reuse current one.
      if (field.value === undefined) field.value = formValues[field.id];

      // fields that were accessed through the context.formValues.X getter should be watched.
      field.watchChanges = used.has(field.id);
    }

    return field;
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
