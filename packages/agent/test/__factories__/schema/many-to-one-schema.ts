import { Factory } from 'fishery';
import { FieldTypes, ManyToOneSchema } from '@forestadmin/datasource-toolkit';

export default Factory.define<ManyToOneSchema>(() => ({
  type: FieldTypes.ManyToOne,
  foreignKey: 'reviewId',
  foreignCollection: 'review',
}));
