import { Factory } from 'fishery';
import { FieldTypes, ManyToOneSchema } from '@forestadmin/datasource-toolkit';

export default Factory.define<ManyToOneSchema>(() => ({
  type: FieldTypes.ManyToOne,
  foreignKey: '165654',
  foreignCollection: 'review',
}));
