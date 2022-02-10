import { Factory } from 'fishery';

import { FieldTypes, ManyToOneSchema } from '../../../src/interfaces/schema';

export default Factory.define<ManyToOneSchema>(() => ({
  type: FieldTypes.ManyToOne,
  foreignKey: 'reviewId',
  foreignCollection: 'review',
}));
