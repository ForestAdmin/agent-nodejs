import { Factory } from 'fishery';
import { Collection } from '@forestadmin/datasource-toolkit';
import datasource from './datasource';
import collectionSchema from './collection-schema';

export default Factory.define<Collection>(() => ({
  dataSource: datasource.build(),
  name: 'a collection',
  schema: collectionSchema.build(),
  getAction: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  aggregate: jest.fn(),
}));
