import {
  CollectionCustomizationContext,
  ComputedDefinition,
  PrimitiveTypes,
  TCollectionName,
  TFieldName,
  TRow,
  TSchema,
} from '@forestadmin/datasource-toolkit';
import { IncomingMessage, ServerResponse } from 'http';

export type FieldDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = ComputedDefinition<S, N> & {
  beforeRelations?: boolean;
};

export type OneToManyEmbeddedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  schema: Record<string, PrimitiveTypes>;
  dependencies?: TFieldName<S, N>[];
  listRecords(
    records: TRow<S, N>,
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
};

export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

export type DataSourceOptions = {
  rename?: { [oldName: string]: string };
};
