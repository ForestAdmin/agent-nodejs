import type { AuditRecord } from '../src';

import { Sequelize } from 'sequelize';

import { createSqlAuditSink, ensureAuditStorage, toRow } from '../src';
import { runAuditMigrations } from '../src/migrations';

jest.mock('../src/migrations', () => ({
  runAuditMigrations: jest.fn().mockResolvedValue(undefined),
}));

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
  afterEach(() => jest.clearAllMocks());

  describe('on a dialect with schemas (postgres)', () => {
    it('creates the schema when missing, then runs the migrations', async () => {
      const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });
      const qi = sequelize.getQueryInterface();
      jest.spyOn(qi, 'showAllSchemas').mockResolvedValue([] as never);
      const createSchema = jest.spyOn(qi, 'createSchema').mockResolvedValue(undefined as never);

      await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

      expect(createSchema).toHaveBeenCalledWith('forest');
      expect(runAuditMigrations).toHaveBeenCalledWith(sequelize, {
        schema: 'forest',
        tableName: 'audit_logs',
      });
    });

    it('does not recreate the schema when it already exists, but still runs migrations', async () => {
      const sequelize = new Sequelize('postgres://user:pwd@localhost:5432/db', { logging: false });
      const qi = sequelize.getQueryInterface();
      jest.spyOn(qi, 'showAllSchemas').mockResolvedValue(['public', 'forest'] as never);
      const createSchema = jest.spyOn(qi, 'createSchema').mockResolvedValue(undefined as never);

      await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

      expect(createSchema).not.toHaveBeenCalled();
      expect(runAuditMigrations).toHaveBeenCalledWith(sequelize, {
        schema: 'forest',
        tableName: 'audit_logs',
      });
    });
  });

  describe('on a dialect without schemas (sqlite)', () => {
    it('skips schema creation and runs migrations without a schema', async () => {
      const sequelize = new Sequelize('sqlite::memory:', { logging: false });
      const createSchema = jest.spyOn(sequelize.getQueryInterface(), 'createSchema');

      await ensureAuditStorage(sequelize, { schema: 'forest', tableName: 'audit_logs' });

      expect(createSchema).not.toHaveBeenCalled();
      expect(runAuditMigrations).toHaveBeenCalledWith(sequelize, {
        schema: undefined,
        tableName: 'audit_logs',
      });

      await sequelize.close();
    });
  });
});

describe('createSqlAuditSink', () => {
  afterEach(() => jest.clearAllMocks());

  it('connects, runs the migrations and returns a sink + close', async () => {
    const { sink, close } = await createSqlAuditSink({
      connectionString: 'sqlite::memory:',
      tableName: 'audit_logs',
    });

    expect(typeof sink).toBe('function');
    expect(runAuditMigrations).toHaveBeenCalled();

    await close();
  });
});
