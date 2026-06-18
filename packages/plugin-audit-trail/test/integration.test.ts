import type {
  Caller,
  FieldSchema,
  Filter as IFilter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import {
  BaseCollection,
  BaseDataSource,
  ConditionTreeFactory,
  Filter,
} from '@forestadmin/datasource-toolkit';

import { InMemoryAuditStore, auditTrail } from '../src';

const operators = new Set(['Equal', 'In', 'NotEqual', 'GreaterThan', 'LessThan', 'Present']);

class AccountsCollection extends BaseCollection {
  private rows: RecordData[] = [];

  constructor(dataSource: BaseDataSource) {
    super('accounts', dataSource);

    const column = (columnType: string, isPrimaryKey = false): FieldSchema => ({
      type: 'Column',
      columnType: columnType as never,
      isPrimaryKey,
      filterOperators: operators as never,
      isSortable: true,
    });

    this.addFields({
      id: column('Number', true),
      status: column('String'),
      name: column('String'),
    });
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    return data.map(datum => {
      const record = { id: this.rows.length + 1, ...datum };
      this.rows.push(record);

      return record;
    });
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const rows = filter?.conditionTree
      ? filter.conditionTree.apply(this.rows, this, caller.timezone)
      : this.rows;

    return projection.apply(rows);
  }

  async update(caller: Caller, filter: IFilter, patch: RecordData): Promise<void> {
    const target = filter?.conditionTree
      ? filter.conditionTree.apply(this.rows, this, caller.timezone)
      : this.rows;
    for (const row of target) Object.assign(row, patch);
  }

  async delete(caller: Caller, filter: IFilter): Promise<void> {
    const target = filter?.conditionTree
      ? filter.conditionTree.apply(this.rows, this, caller.timezone)
      : this.rows;
    for (const row of target) this.rows.splice(this.rows.indexOf(row), 1);
  }

  async aggregate(): Promise<never[]> {
    return [];
  }
}

const caller = (requestId: string): Caller =>
  ({
    id: 7,
    email: 'jane@forest.dev',
    role: 'admin',
    requestId,
    timezone: 'Europe/Paris',
  } as unknown as Caller);

async function buildCollection() {
  const store = new InMemoryAuditStore();
  const customizer = new DataSourceCustomizer();
  customizer.addDataSource(async () => {
    const dataSource = new BaseDataSource();
    dataSource.addCollection(new AccountsCollection(dataSource));

    return dataSource;
  });
  customizer.use(auditTrail, { store });

  const dataSource = await customizer.getDataSource(() => {});
  const collection = dataSource.getCollection('accounts');
  const matchId = (id: number) =>
    new Filter({ conditionTree: ConditionTreeFactory.matchIds(collection.schema, [[id]]) });

  return { store, collection, matchId };
}

describe('auditTrail against a real DataSourceCustomizer stack', () => {
  it('captures a create through the real hook decorator', async () => {
    const { store, collection } = await buildCollection();

    await collection.create(caller('r-create'), [{ status: 'open', name: 'Acme' }]);

    expect(store.listByRecord({ collection: 'accounts', recordId: '1' })).toEqual([
      expect.objectContaining({
        operation: 'create',
        userId: 7,
        correlationKey: 'r-create',
        previousValues: {},
        newValues: { id: 1, status: 'open', name: 'Acme' },
      }),
    ]);
  });

  it('captures an update with before/after, proving the filter-keyed snapshot works on the real stack', async () => {
    const { store, collection, matchId } = await buildCollection();
    await collection.create(caller('r-create'), [{ status: 'open', name: 'Acme' }]);

    await collection.update(caller('r-update'), matchId(1), { status: 'closed' });

    const history = store.listByRecord({ collection: 'accounts', recordId: '1' });
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      operation: 'update',
      correlationKey: 'r-update',
      previousValues: { status: 'open' },
      newValues: { status: 'closed' },
    });
  });

  it('captures a delete with the previous value through the real hook decorator', async () => {
    const { store, collection, matchId } = await buildCollection();
    await collection.create(caller('r-create'), [{ status: 'open', name: 'Acme' }]);

    await collection.delete(caller('r-delete'), matchId(1));

    const history = store.listByRecord({ collection: 'accounts', recordId: '1' });
    expect(history[history.length - 1]).toMatchObject({
      operation: 'delete',
      correlationKey: 'r-delete',
      previousValues: { id: 1, status: 'open', name: 'Acme' },
      newValues: {},
    });
  });

  it('groups a bulk delete (one request, N ids) under one correlation key, one row per record', async () => {
    const { store, collection } = await buildCollection();
    await collection.create(caller('r-create'), [
      { status: 'open', name: 'Acme' },
      { status: 'open', name: 'Globex' },
    ]);

    await collection.delete(caller('r-bulk-del'), new Filter({}));

    const first = store.listByRecord({ collection: 'accounts', recordId: '1' });
    const second = store.listByRecord({ collection: 'accounts', recordId: '2' });
    expect(first[first.length - 1]).toMatchObject({
      operation: 'delete',
      correlationKey: 'r-bulk-del',
      previousValues: { id: 1, status: 'open', name: 'Acme' },
      newValues: {},
    });
    expect(second[second.length - 1]).toMatchObject({
      operation: 'delete',
      correlationKey: 'r-bulk-del',
      previousValues: { id: 2, status: 'open', name: 'Globex' },
      newValues: {},
    });
  });

  it('groups a bulk update under one correlation key, one row per matched record', async () => {
    const { store, collection } = await buildCollection();
    await collection.create(caller('r-create'), [
      { status: 'open', name: 'Acme' },
      { status: 'pending', name: 'Globex' },
    ]);

    await collection.update(caller('r-bulk'), new Filter({}), { status: 'closed' });

    const first = store.listByRecord({ collection: 'accounts', recordId: '1' });
    const second = store.listByRecord({ collection: 'accounts', recordId: '2' });
    expect(first[first.length - 1]).toMatchObject({
      operation: 'update',
      correlationKey: 'r-bulk',
      previousValues: { status: 'open' },
      newValues: { status: 'closed' },
    });
    expect(second[second.length - 1]).toMatchObject({
      operation: 'update',
      correlationKey: 'r-bulk',
      previousValues: { status: 'pending' },
      newValues: { status: 'closed' },
    });
  });
});
