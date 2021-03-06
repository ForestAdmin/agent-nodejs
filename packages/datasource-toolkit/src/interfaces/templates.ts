import { RecordData } from './record';

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

/** Global schema which is generated by agent */
export type TSchema = Record<string, { plain: RecordData; nested: RecordData; flat: RecordData }>;

/** Collection name */
export type TCollectionName<S extends TSchema> = Extract<keyof S, string>;

/** Column name (no relations) */
export type TColumnName<S extends TSchema, N extends TCollectionName<S>> = Extract<
  keyof S[N]['plain'],
  string
>;

/** Field name (with relations) */
export type TFieldName<S extends TSchema, N extends TCollectionName<S>> = Extract<
  keyof S[N]['plain'] | keyof S[N]['flat'],
  string
>;

/** Type of a given field */
export type TFieldType<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
  C extends TFieldName<S, N> = TFieldName<S, N>,
> = (S[N]['plain'] & S[N]['flat'])[C];

/** Row type only with columns (all required) */
export type TSimpleRow<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = S[N]['plain'];

/** Row type only with columns (all optional) */
export type TPartialSimpleRow<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = RecursivePartial<TSimpleRow<S, N>>;

/** Row type with columns and relationships (all required) */
export type TRow<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = S[N]['plain'] & S[N]['nested'];

/** Row type with columns and relationships (all optional) */
export type TPartialRow<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = RecursivePartial<TRow<S, N>>;

export type TPartialFlatRow<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = RecursivePartial<S[N]['plain'] & S[N]['flat']>;
