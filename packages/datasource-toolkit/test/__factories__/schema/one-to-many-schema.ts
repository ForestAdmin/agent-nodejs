import { Factory } from 'fishery';
import { FieldTypes, OneToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<OneToManySchema>(() => ({
  type: FieldTypes.OneToMany,
  originKey: 'reviewId',
  originKeyTarget: 'id',
  foreignCollection: 'review',
}));
