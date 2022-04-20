import {
  AggregateResult,
  Aggregation,
  Filter,
  PaginatedFilter,
  Projection,
  QueryRecipient,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { SequelizeCollection } from '@forestadmin/datasource-sequelize';

export default class LiveCollection extends SequelizeCollection {
  private synched = false;

  private ensureSynched(): void {
    if (!this.synched) {
      throw new Error(`Collection "${this.name}" is not synched yet. Call "sync" first.`);
    }
  }

  async sync(): Promise<boolean> {
    this.synched = false;

    await this.model.sync({ force: true });
    this.synched = true;

    return true;
  }

  override create(recipient: QueryRecipient, data: RecordData[]): Promise<RecordData[]> {
    this.ensureSynched();

    return super.create(recipient, data);
  }

  override list(
    recipient: QueryRecipient,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    this.ensureSynched();

    return super.list(recipient, filter, projection);
  }

  override update(recipient: QueryRecipient, filter: Filter, patch: RecordData): Promise<void> {
    this.ensureSynched();

    return super.update(recipient, filter, patch);
  }

  override delete(recipient: QueryRecipient, filter: Filter): Promise<void> {
    this.ensureSynched();

    return super.delete(recipient, filter);
  }

  override aggregate(
    recipient: QueryRecipient,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    this.ensureSynched();

    return super.aggregate(recipient, filter, aggregation, limit);
  }
}
