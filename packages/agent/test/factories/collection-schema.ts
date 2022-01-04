import { Factory } from 'fishery';
import { CollectionSchema, CollectionSchemaScope } from '@forestadmin/datasource-toolkit';

export default Factory.define<CollectionSchema>(() => ({
  actions: [{ name: 'a name', scope: CollectionSchemaScope.single }],
  fields: {},
  searchable: true,
  segments: [],
}));
