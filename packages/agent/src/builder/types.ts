import { ComputedDefinition, TCollectionName, TSchema } from '@forestadmin/datasource-toolkit';

export type FieldDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = ComputedDefinition<S, N> & {
  beforeRelations?: boolean;
};
