import { Caller } from '../../interfaces/caller';
import { Chart } from '../../interfaces/chart';
import { DataSourceSchema } from '../../interfaces/schema';
import Collection from '../collection/collection';

export default interface DataSource {
  get collections(): Collection[];
  get schema(): DataSourceSchema;

  getCollection(name: string): Collection;
  addCollection(collection: Collection): void;

  renderChart(caller: Caller, name: string): Promise<Chart>;
}
