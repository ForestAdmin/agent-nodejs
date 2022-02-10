import { Factory } from 'fishery';

import { FieldTypes, OneToOneSchema } from '../../../src/interfaces/schema';

export default Factory.define<OneToOneSchema>(() => ({
  type: FieldTypes.OneToOne,
  foreignKey: 'reviewId',
  foreignCollection: 'review',
}));
