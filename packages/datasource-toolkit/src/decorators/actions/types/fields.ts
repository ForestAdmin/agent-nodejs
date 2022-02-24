import { ActionFieldType } from '../../../interfaces/action';
import { CompositeId } from '../../../interfaces/record';

export type ValueOrHandler<Context = unknown, Result = unknown> =
  | ((context: Context) => Promise<Result>)
  | ((context: Context) => Result)
  | Result;

type JSONValue = string | number | boolean | { [x: string]: JSONValue } | Array<JSONValue>;

interface BaseDynamicField<Context, Result> {
  label: string;
  description?: string;
  isRequired?: ValueOrHandler<Context, boolean>;
  isReadOnly?: ValueOrHandler<Context, boolean>;

  if?: ValueOrHandler<Context, boolean>;
  value?: ValueOrHandler<Context, Result>;
  defaultValue?: ValueOrHandler<Context, Result>;
}

interface BooleanDynamicField<Context> extends BaseDynamicField<Context, boolean> {
  type: ActionFieldType.Boolean;
}

interface CollectionDynamicField<Context> extends BaseDynamicField<Context, CompositeId> {
  type: ActionFieldType.Collection;
  collectionName?: ValueOrHandler<Context, string>;
}

interface EnumDynamicField<Context> extends BaseDynamicField<Context, string> {
  type: ActionFieldType.Enum;
  enumValues: ValueOrHandler<Context, string[]>;
}

interface EnumListDynamicField<Context> extends BaseDynamicField<Context, string[]> {
  type: ActionFieldType.EnumList;
  enumValues: ValueOrHandler<Context, string[]>;
}

interface JsonDynamicField<Context> extends BaseDynamicField<Context, JSONValue> {
  type: ActionFieldType.Json;
}

interface NumberDynamicField<Context> extends BaseDynamicField<Context, number> {
  type: ActionFieldType.Number;
}

interface NumberListDynamicField<Context> extends BaseDynamicField<Context, number[]> {
  type: ActionFieldType.NumberList;
}

interface StringDynamicField<Context> extends BaseDynamicField<Context, string> {
  type:
    | ActionFieldType.Date
    | ActionFieldType.Dateonly
    | ActionFieldType.File
    | ActionFieldType.String;
}

interface StringListDynamicField<Context> extends BaseDynamicField<Context, string[]> {
  type: ActionFieldType.FileList | ActionFieldType.StringList;
}

export type DynamicField<Context = unknown> =
  | BooleanDynamicField<Context>
  | CollectionDynamicField<Context>
  | EnumDynamicField<Context>
  | EnumListDynamicField<Context>
  | JsonDynamicField<Context>
  | NumberDynamicField<Context>
  | NumberListDynamicField<Context>
  | StringDynamicField<Context>
  | StringListDynamicField<Context>;
