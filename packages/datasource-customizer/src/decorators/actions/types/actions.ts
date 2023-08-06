import { ActionResult, ActionScope, ActionScopeEnum } from '@forestadmin/datasource-toolkit';
import { ENUM } from 'sequelize';
import { z } from 'zod';

import { DynamicField } from './fields';
import { TCollectionName, TSchema } from '../../../templates';
import ActionContext from '../context/base';
import ActionContextSingle from '../context/single';
import ResultBuilder from '../result-builder';

export { ActionContext, ActionContextSingle };
const scope = [
  ...Object.values(ActionScopeEnum),
  ...Object.values(ActionScopeEnum).map(scope => scope.toLowerCase()),
];

// export const actionSchema = {
//  type: 'object',
//  properties: {
//    generateFile: { type: 'boolean' },
//    scope: {
//      type: 'string',
//      enum: [
//        ...Object.values(ActionScopeEnum),
//        ...Object.values(ActionScopeEnum).map(scope => scope.toLowerCase()),
//      ],
//    },
//    form: { type: 'array' }, // validated in fieldActionSchema
//    execute: { typeof: 'function' },
//  },
//  required: ['scope', 'execute'],
//  additionalProperties: false,
// };

function actionSchema<
  S extends TSchema,
  N extends TCollectionName<S>,
  Scope extends ActionScope,
  Context extends ActionContext<S, N>,
>() {
  const returnType = z.union([z.void(), z.any() as z.ZodSchema<ActionResult>]);

  return z.object({
    generateFile: z.boolean().optional(),
    scope: z.enum(['Bulk', 'Global', 'Single']),
    form: (z.any() as z.ZodSchema<DynamicField<Context>>).array().optional(),
    execute: z
      .function()
      .args(z.any() as z.ZodSchema<Context>, z.any() as z.ZodSchema<ResultBuilder>)
      .returns(z.union([returnType, returnType.promise()])),
  });
}

// function actionSchema<HandlerArgType extends z.ZodTypeAny, ResultOrValueType extends z.ZodTypeAny>(
//  fieldValueType: ResultOrValueType,
// ) {
//  return z.object({
//    generateFile: z.boolean().optional(),
//    scope: z.enum([scope[0], ...scope.slice(1)]),
//    form: z.object({}).array().optional(),
//    execute: z.function(),
//  });
// }

type t = ReturnType<
  typeof actionSchema<
    TSchema,
    TCollectionName<TSchema>,
    'Global',
    ActionContext<TSchema, TCollectionName<TSchema>>
  >
>;

export type ActionDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = z.infer<t>;

const action: ActionDefinition = {
  scope: 'Bulk',
  form: [{ type: 'Boolean', label: 'aaa' }],
  execute: async (toto, baby) => {
    console.log('aa');
  },
};

const action2: DynamicField<ActionContext> = {
  type: 'Collection',
};

// export interface BaseAction<
//  S extends TSchema,
//  N extends TCollectionName<S>,
//  Scope extends ActionScope,
//  Context extends ActionContext<S, N>,
// > {
//  generateFile?: boolean;
//  scope: Scope;
//  form?: DynamicField<Context>[];
//  execute(
//    context: Context,
//    resultBuilder: ResultBuilder,
//  ): void | ActionResult | Promise<void> | Promise<ActionResult>;
// }

// export type ActionGlobal<
//  S extends TSchema = TSchema,
//  N extends TCollectionName<S> = TCollectionName<S>,
// > = BaseAction<S, N, 'Global', ActionContext<S, N>>;
// type t = ReturnType<
//  typeof actionSchema<
//    TSchema,
//    TCollectionName<TSchema>,
//    'Global',
//    ActionContext<TSchema, TCollectionName<TSchema>>
//  >
// >;
// export type ActionGlobal = z.infer<t>;
// const ag: ActionGlobal = {
//  scope: 'Toto',
// };

// const action: z.infer<ReturnType<typeof actionSchema>> = {
//  scope: 'bulk',
//  generateFile: true,
//  form: [],
//  execute: async (toto, baby) => {
//    console.log('aa');
//  },
// };
//

// export type ActionBulk<
//  S extends TSchema = TSchema,
//  N extends TCollectionName<S> = TCollectionName<S>,
// > = BaseAction<S, N, 'Bulk', ActionContext<S, N>>;
//
// export type ActionSingle<
//  S extends TSchema = TSchema,
//  N extends TCollectionName<S> = TCollectionName<S>,
// > = BaseAction<S, N, 'Single', ActionContextSingle<S, N>>;
//
// export type ActionDefinition<
//  S extends TSchema = TSchema,
//  N extends TCollectionName<S> = TCollectionName<S>,
// > = ActionSingle<S, N> | ActionBulk<S, N> | ActionGlobal<S, N>;
