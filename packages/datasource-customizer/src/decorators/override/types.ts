import type {
  CreateOverrideCustomizationContext,
  DeleteOverrideCustomizationContext,
  UpdateOverrideCustomizationContext,
} from './context';
import type { TCollectionName, TPartialSimpleRow, TSchema } from '../../templates';

export type CreateOverrideHandler<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: CreateOverrideCustomizationContext<S, N>) => Promise<TPartialSimpleRow[]>;

export type UpdateOverrideHandler<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: UpdateOverrideCustomizationContext<S, N>) => Promise<void>;

export type DeleteOverrideHandler<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: DeleteOverrideCustomizationContext<S, N>) => Promise<void>;
