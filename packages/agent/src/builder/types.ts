import { ComputedDefinition, TCollectionName, TSchema } from '@forestadmin/datasource-toolkit';
import { IncomingMessage, ServerResponse } from 'http';

export type FieldDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = ComputedDefinition<S, N> & {
  beforeRelations?: boolean;
};

export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;
