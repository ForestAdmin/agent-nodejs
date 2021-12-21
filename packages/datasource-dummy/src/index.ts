import { Collection } from '@forestadmin/datasource-toolkit';
import DummyDataSource from './datasource';

export default function getCollections(): Collection[] {
  return new DummyDataSource().collections;
}
