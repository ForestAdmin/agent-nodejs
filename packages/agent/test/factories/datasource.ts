import { Factory } from 'fishery';
import { DataSource } from '@forestadmin/datasource-toolkit';

export default Factory.define<DataSource>(() => ({
  collections: [],
  getCollection: jest.fn(),
}));
