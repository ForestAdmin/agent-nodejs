import {
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  OneToOneSchema,
} from '../../interfaces/schema';

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type PartialRelationSchema =
  | PartialBy<ManyToOneSchema, 'foreignKeyTarget'>
  | PartialBy<OneToManySchema | OneToOneSchema, 'originKeyTarget'>
  | PartialBy<ManyToManySchema, 'foreignKeyTarget' | 'originKeyTarget'>;
