import { GROUPS, dataMap } from '../src/charts/data-map';

// Every table of the domains (GROUPS), detail tables included.
const TABLES = (GROUPS as [string, string, string[]][]).flatMap(([, , list]) =>
  list.map(t => t.replace(/^-/, '')),
);

/** A data source whose tables have 10 rows each, except `failing`, whose count throws. */
function stubDataSource(failing: string[]) {
  const aggregate = jest.fn();
  const collections = Object.fromEntries(
    TABLES.map(name => [
      name,
      {
        schema: {
          fields: { id: { type: 'Column', columnType: 'Number', isPrimaryKey: true } },
          actions: {},
        },
        aggregate: (...args: unknown[]) => {
          aggregate(name, ...args);

          return failing.includes(name)
            ? Promise.reject(new Error('SQLITE_BUSY: database is locked'))
            : Promise.resolve([{ value: 10, group: {} }]);
        },
      },
    ]),
  );

  return { aggregate, dataSource: { getCollection: (name: string) => collections[name] } };
}

const tableOf = (map, name: string) =>
  map.domains.flatMap(d => d.tables).find(t => t.name === name);

describe('dataMap', () => {
  // data-map.js keeps a full count a minute: each case starts an hour later, on a cold cache.
  let now = Date.now();

  beforeEach(() => {
    now += 3600 * 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should list a table whose count failed as unavailable, with no rows', async () => {
    const { aggregate, dataSource } = stubDataSource(['alerts']);

    const map = await dataMap(dataSource);

    expect(map.unavailable).toEqual(['alerts']);
    expect(tableOf(map, 'alerts').rows).toBeNull();
    expect(tableOf(map, 'customers').rows).toBe(10);
    expect(map.stats.rows).toBe(10 * (TABLES.length - 1));
    expect(aggregate).toHaveBeenCalledTimes(TABLES.length);
    expect(aggregate).toHaveBeenCalledWith('alerts', {}, { operation: 'Count' });
  });

  it('should count again on the next read after a failure', async () => {
    await dataMap(stubDataSource(['alerts']).dataSource);
    const recovered = stubDataSource([]);

    const map = await dataMap(recovered.dataSource);

    expect(map.unavailable).toEqual([]);
    expect(tableOf(map, 'alerts').rows).toBe(10);
    expect(recovered.aggregate).toHaveBeenCalledTimes(TABLES.length);
    expect(recovered.aggregate).toHaveBeenCalledWith('alerts', {}, { operation: 'Count' });
  });

  it('should keep a full count for a minute without counting again', async () => {
    await dataMap(stubDataSource([]).dataSource);
    now += 59 * 1000;
    const failing = stubDataSource(['alerts']);

    const cached = await dataMap(failing.dataSource);

    expect(cached.unavailable).toEqual([]);
    expect(tableOf(cached, 'alerts').rows).toBe(10);
    expect(failing.aggregate).not.toHaveBeenCalled();
  });
});
