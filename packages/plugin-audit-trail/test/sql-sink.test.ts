import type { AuditRecord } from '../src';

import { Sequelize } from 'sequelize';

import { createSqlAuditSink, ensureAuditStorage, toRow } from '../src';

const record = (over: Partial<AuditRecord> = {}): AuditRecord => ({
  timestamp: '2026-01-02T03:04:05.000Z',
  operation: 'update',
  collection: 'accounts',
  recordId: '1',
  userId: 42,
  correlationKey: 'req-1',
  previousValues: { status: 'open' },
  newValues: { status: 'closed' },
  ...over,
});

describe('toRow', () => {
  it('maps every audit-record field, including the flat user id', () => {
    expect(toRow(record())).toEqual({
      timestamp: '2026-01-02T03:04:05.000Z',
      operation: 'update',
      collection: 'accounts',
      recordId: '1',
      userId: 42,
      correlationKey: 'req-1',
      previousValues: { status: 'open' },
      newValues: { status: 'closed' },
    });
  });
});

describe('ensureAuditStorage', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('on a dialect with schemas (postgres)', () => {
    it('creates the schema when it is missing', async () => {
      const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });
      const qi = sequelize.getQueryInterface();
      jest.spyOn(qi, 'showAllSchemas').mockResolvedValue([] as never);
      const createSchema = jest.spyOn(qi, 'createSchema').mockResolvedValue(undefined as never);
      jest
        .spyOn(Sequelize.prototype, 'define')
        .mockReturnValue({ sync: jest.fn().mockResolvedValue(undefined) } as never);

      await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

      expect(createSchema).toHaveBeenCalledWith('forest');
    });

    it('does not recreate the schema when it already exists', async () => {
      const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });
      const qi = sequelize.getQueryInterface();
      jest.spyOn(qi, 'showAllSchemas').mockResolvedValue(['public', 'forest'] as never);
      const createSchema = jest.spyOn(qi, 'createSchema').mockResolvedValue(undefined as never);
      jest
        .spyOn(Sequelize.prototype, 'define')
        .mockReturnValue({ sync: jest.fn().mockResolvedValue(undefined) } as never);

      await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

      expect(createSchema).not.toHaveBeenCalled();
    });
  });

  describe('on a dialect without schemas (sqlite)', () => {
    it('skips schema creation entirely', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });
      const qi = sequelize.getQueryInterface();
      const createSchema = jest.spyOn(qi, 'createSchema');

      await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

      expect(createSchema).not.toHaveBeenCalled();
      await sequelize.close();
    });
  });
});

describe('createSqlAuditSink (sqlite round-trip)', () => {
  it('connects, bootstraps the table, and returns a working sink + close', async () => {
    const result = await createSqlAuditSink({
      connectionString: 'sqlite::memory:',
      tableName: 'audit_logs',
    });

    expect(typeof result.sink).toBe('function');
    await expect(result.sink(record())).resolves.toBeUndefined();
    await result.close();
  });

  it('persists a record into a flat user_id column', async () => {
    const sequelize = new Sequelize('sqlite::memory:', { logging: false });
    const model = await ensureAuditStorage(sequelize, {
      schema: 'forest',
      tableName: 'audit_logs',
    });

    await model.create(toRow(record()));

    const rows = await model.findAll();
    expect(rows).toHaveLength(1);

    const stored = rows[0].toJSON();
    expect(stored).toMatchObject({
      operation: 'update',
      collection: 'accounts',
      recordId: '1',
      userId: 42,
      correlationKey: 'req-1',
      previousValues: { status: 'open' },
      newValues: { status: 'closed' },
    });
    expect(stored).not.toHaveProperty('actor');

    await sequelize.close();
  });
});
