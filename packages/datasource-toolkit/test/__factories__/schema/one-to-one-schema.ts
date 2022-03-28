import { Factory } from 'fishery';
import { FieldTypes, OneToOneSchema } from '../../../src/interfaces/schema';

export default Factory.define<OneToOneSchema>(() => ({
  type: FieldTypes.OneToOne,
  originKey: 'reviewId',
  originKeyTarget: 'id',
  foreignCollection: 'review',
}));
