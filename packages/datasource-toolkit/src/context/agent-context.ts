import { DataSource } from '../interfaces/collection';
import RelaxedDataSource from './relaxed-wrappers/datasource';

export default class AgentCustomizationContext {
  private realDataSource: DataSource;
  readonly timezone: string;

  get dataSource(): RelaxedDataSource {
    return new RelaxedDataSource(this.realDataSource);
  }

  constructor(dataSource: DataSource, timezone: string = null) {
    this.realDataSource = dataSource;
    this.timezone = timezone;
  }
}
