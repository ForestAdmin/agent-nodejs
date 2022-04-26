import {
  AggregateResult,
  Aggregation,
  Caller,
  Filter,
  PaginatedFilter,
  Projection,
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

  override create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    this.ensureSynched();

    return super.create(caller, data);
  }

  override list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    this.ensureSynched();

    return super.list(caller, filter, projection);
  }

  override update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    this.ensureSynched();

    return super.update(caller, filter, patch);
  }

  override delete(caller: Caller, filter: Filter): Promise<void> {
    this.ensureSynched();

    return super.delete(caller, filter);
  }

  override aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    this.ensureSynched();

    return super.aggregate(caller, filter, aggregation, limit);
  }
}
