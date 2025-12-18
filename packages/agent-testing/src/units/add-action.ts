import type { ActionContext, CollectionCustomizerFunction, TestableAction } from './types';

import {
  ActionContextSingle,
  DynamicField,
  DynamicForm,
  TSchema,
} from '@forestadmin/datasource-customizer';

function getFieldId(field: DynamicField<ActionContextSingle<TSchema, string>>) {
  return 'id' in field && field.id ? field.id : field.label;
}

/**
 * Return a TestableAction allowing you to unit test action definition
 */
export function getAddedAction(
  collectionCustomizerFunction: CollectionCustomizerFunction,
  ...args: any[]
): TestableAction {
  let action: TestableAction;

  const collection = {
    addAction(name, definition) {
      if (action) throw new Error('You have two addAction in your customization');
      action = { definition, name };

      return this;
    },
  };

  collectionCustomizerFunction(collection as any, ...args);

  return action;
}

function getInputFieldFromForm<T>(
  form: DynamicForm<ActionContextSingle<TSchema, string>>,
  id: string,
) {
  return form.find(
    field =>
      field.type !== 'Layout' &&
      getFieldId(field as DynamicField<ActionContextSingle<TSchema, string>>) === id,
  ) as unknown as T;
}

/**
 * Static Form field accessor
 */
export function getFormFieldAction<T>(action: TestableAction, id: string): T {
  if (!action.definition.form) return null;

  if (action.definition.form instanceof Function) {
    throw new Error('Use getDynamicFormFieldAction function helper');
  }

  return getInputFieldFromForm<T>(action.definition.form, id);
}

/**
 * Dynamic Form field accessor
 */
export async function getDynamicFormFieldAction<T>(
  action: TestableAction,
  id: string,
  actionContext: ActionContext,
): Promise<T> {
  if (!action.definition.form) return null;

  if (!(action.definition.form instanceof Function)) {
    throw new Error('Use getFormFieldAction function helper');
  }

  const form = await action.definition.form(actionContext);

  return getInputFieldFromForm<T>(form, id);
}

export function getFormFieldValueAction<ReturnType>(
  action: TestableAction,
  id: string,
): (actionContext: ActionContext) => Promise<ReturnType> {
  if (!action.definition.form) return null;

  if (action.definition.form instanceof Function) {
    throw new Error('Use getDynamicFormFieldValueAction function helper');
  }

  return (
    getFormFieldAction(action, id) as {
      value: (actionContext: ActionContext) => Promise<ReturnType>;
    }
  ).value;
}

export async function getDynamicFormFieldValueAction<ReturnType>(
  action: TestableAction,
  id: string,
  actionContext: ActionContext,
): Promise<(actionContext: ActionContext) => Promise<ReturnType>> {
  if (!action.definition.form) return null;

  if (!(action.definition.form instanceof Function)) {
    throw new Error('Use getFormFieldValueAction function helper');
  }

  return (
    (await getDynamicFormFieldAction(action, id, actionContext)) as {
      value: (actionContext: ActionContext) => Promise<ReturnType>;
    }
  ).value;
}
