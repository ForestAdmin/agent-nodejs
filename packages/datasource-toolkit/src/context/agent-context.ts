import { DataSource } from '../interfaces/collection';
import { QueryRecipient } from '../interfaces/user';
import RelaxedDataSource from './relaxed-wrappers/datasource';

export default class AgentCustomizationContext {
  private realDataSource: DataSource;
  readonly recipient: QueryRecipient;

  get dataSource(): RelaxedDataSource {
    return new RelaxedDataSource(this.realDataSource, this.recipient);
  }

  constructor(dataSource: DataSource, recipient: QueryRecipient) {
    this.realDataSource = dataSource;
    this.recipient = recipient;
  }
}
