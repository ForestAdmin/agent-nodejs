import type { Caller, Logger } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  ConditionTreeLeaf,
  Filter,
  Page,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { SEGMENTS } from '../src/customizations/shared/segments';
import { createDemoBankDataSource } from '../src/index';
import { tables } from '../src/model/schema';

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
// What the demo layout's buttons call, collection by collection, in declaration order.
const expectedActions = fixture('actions.json');
// The API charts the demo workspaces' Custom components read, sorted.
const expectedCharts = fixture('charts.json');

// Seeding writes about 300,000 rows.
jest.setTimeout(120_000);

describe('createDemoBankDataSource', () => {
  const logger: Logger = () => {};

  const restartAgent = jest.fn().mockResolvedValue(undefined);
  const caller = { id: 1, timezone: 'Europe/Paris' } as Caller;
  const cwd = process.cwd();
  let folder: string;

  beforeAll(() => {
    // The data source seeds db.sqlite in the current folder.
    folder = mkdtempSync(path.join(tmpdir(), 'demo-bank-'));
    process.chdir(folder);
  });

  afterAll(() => {
    process.chdir(cwd);
    rmSync(folder, { recursive: true, force: true });
  });

  it('should not crash', () => {
    expect(() => createDemoBankDataSource()).not.toThrow();
  });

  it('should rebuild a fresh database on each boot without failing on existing tables', async () => {
    await createDemoBankDataSource()(logger, restartAgent);

    await expect(createDemoBankDataSource()(logger, restartAgent)).resolves.toBeDefined();
  });

  describe('once booted', () => {
    let dataSource;

    beforeAll(async () => {
      dataSource = await createDemoBankDataSource()(logger, restartAgent);
    });

    it('should expose exactly the 59 tables of data-model.json as collections', () => {
      const names = dataSource.collections.map(c => c.name).sort();

      expect(names).toEqual(Object.keys(tables).sort());
      expect(names).toHaveLength(59);
    });

    it('should declare the Smart Actions the demo layout calls, in their order', () => {
      // The layout's buttons call /forest/_actions/<collection>/<index>/…: the order matters.
      const actions = Object.fromEntries(
        dataSource.collections
          .map(c => [c.name, Object.keys(c.schema.actions)])
          .filter(([, names]) => names.length),
      );

      expect(actions).toStrictEqual(expectedActions);
    });

    it('should declare exactly the 22 charts of fixtures/charts.json', () => {
      expect([...dataSource.schema.charts].sort()).toEqual(expectedCharts);
      expect(expectedCharts).toHaveLength(22);
    });

    it("should create the KYC case desk's showcase cases", async () => {
      const rows = await dataSource.getCollection('kyc_cases').list(
        caller,
        new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('reference', 'StartsWith', 'KYC-DEMO-'),
        }),
        new Projection('reference'),
      );

      expect(rows.map(row => row.reference).sort()).toEqual([
        'KYC-DEMO-0001',
        'KYC-DEMO-0002',
        'KYC-DEMO-0003',
        'KYC-DEMO-0004',
      ]);
    });

    describe("the partner app's Smart Actions on kyc_cases", () => {
      const byId = (id: string) =>
        new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', id) });
      const application = {
        Partner: 'Jest Partner',
        'Partner reference': 'JEST-0001',
        'First name': 'Ada',
        'Last name': 'Testerson',
        'Date of birth': '1990-05-12',
        Nationality: 'FR',
        Email: 'ada.testerson@example.com',
        Phone: '+33 6 12 34 56 78',
        Address: '1 rue de la Paix',
        'Postal code': '75002',
        City: 'Paris',
        Country: 'FR',
        'Employment status': 'EMPLOYED',
        Occupation: 'Engineer',
        'Income band': 'FROM_40K_TO_70K',
        'Source of funds': 'SALARY',
        'Expected monthly income': 3200,
        'Expected monthly spending': 2100,
      };

      it('should open an OPEN onboarding case for the partner on "Submit application"', async () => {
        const kycCases = dataSource.getCollection('kyc_cases');

        const result = await kycCases.execute(caller, 'Submit application', application);
        const cases = await kycCases.list(
          caller,
          new PaginatedFilter({
            conditionTree: new ConditionTreeLeaf('partner', 'Equal', 'Jest Partner'),
          }),
          new Projection('reference', 'type', 'status', 'channel', 'notes'),
        );

        expect(cases).toEqual([
          {
            reference: expect.stringMatching(/^KYC-/),
            type: 'ONBOARDING',
            status: 'OPEN',
            channel: 'PARTNER',
            notes: 'Partner: Jest Partner · application JEST-0001',
          },
        ]);
        expect(result).toMatchObject({
          type: 'Success',
          message: expect.stringMatching(
            new RegExp(
              `^Application ${cases[0].reference} received from Partner: Jest Partner, for Ada Testerson \\(`,
            ),
          ),
        });
      });

      // How many rows a table holds, or those matching `field` = `value`.
      const countOf = async (name: string, field?: string, value?: unknown) => {
        const [{ value: count }] = await dataSource
          .getCollection(name)
          .aggregate(
            caller,
            new Filter(
              field ? { conditionTree: new ConditionTreeLeaf(field, 'Equal', value) } : {},
            ),
            new Aggregation({ operation: 'Count' }),
          );

        return count;
      };

      it.each([
        ['without an income band', { 'Income band': undefined }, 'an income band from its list'],
        [
          'with an employment status off its list',
          { 'Employment status': 'ASTRONAUT' },
          'an employment status from its list',
        ],
      ])(
        'should refuse "Submit application" %s before writing anything',
        async (_, change, what) => {
          const before = [await countOf('kyc_cases'), await countOf('individuals')];

          const result = await dataSource
            .getCollection('kyc_cases')
            .execute(caller, 'Submit application', {
              ...application,
              'First name': 'Eve',
              ...change,
            });

          expect(result).toMatchObject({
            type: 'Error',
            message: `The application needs ${what}.`,
          });
          expect([await countOf('kyc_cases'), await countOf('individuals')]).toEqual(before);
        },
      );

      it('should refuse a second application from a person whose first one is in progress', async () => {
        const result = await dataSource
          .getCollection('kyc_cases')
          .execute(caller, 'Submit application', application);

        expect(result).toMatchObject({
          type: 'Error',
          message: expect.stringMatching(
            /^Ada Testerson has an application in progress \(KYC-[^)]+\)\.$/,
          ),
        });
      });

      it.each(['APPROVED', 'REJECTED'])(
        'should refuse "Upload document" on a case that is %s already',
        async status => {
          const kycCases = dataSource.getCollection('kyc_cases');
          const [closed] = await kycCases.list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('status', 'Equal', status),
              page: new Page(0, 1),
            }),
            new Projection('id', 'reference'),
          );

          const result = await kycCases.execute(
            caller,
            'Upload document',
            { 'Document type': 'PASSPORT' },
            byId(closed.id),
          );

          expect(result).toMatchObject({
            type: 'Error',
            message: `${closed.reference} is ${status.toLowerCase()} already.`,
          });
        },
      );

      describe('"Upload document" on a case in review', () => {
        let kyc: { id: string; reference: string };

        beforeAll(async () => {
          [kyc] = await dataSource.getCollection('kyc_cases').list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('status', 'Equal', 'IN_REVIEW'),
              page: new Page(0, 1),
            }),
            new Projection('id', 'reference'),
          );
        });

        const PDF = Buffer.from('%PDF-1.4\n%%EOF');
        const upload = (values: Record<string, unknown>) =>
          dataSource.getCollection('kyc_cases').execute(
            caller,
            'Upload document',
            {
              'Document type': 'PROOF_OF_ADDRESS',
              File: { mimeType: 'application/pdf', buffer: PDF, name: 'bill.pdf' },
              ...values,
            },
            byId(kyc.id),
          );

        it('should file an inline File under its type, whatever the File URL says', async () => {
          const before = await countOf('documents', 'kyc_case_id', kyc.id);

          const result = await upload({ 'File URL': 'not a link', 'File name': 'evil.html' });
          const [row] = await dataSource.getCollection('documents').list(
            caller,
            new PaginatedFilter({
              conditionTree: new ConditionTreeLeaf('file_name', 'Equal', 'evil.pdf'),
            }),
            new Projection('kyc_case_id', 'document_type'),
          );

          expect(result).toMatchObject({
            type: 'Success',
            message: `Proof of address added to ${kyc.reference}, waiting for its check.`,
          });
          expect(row).toEqual({ kyc_case_id: kyc.id, document_type: 'PROOF_OF_ADDRESS' });
          expect(await countOf('documents', 'kyc_case_id', kyc.id)).toBe(before + 1);
        });

        it.each([
          ['Issued on', '2024-02-31'],
          ['Expires on', '2024-13-45'],
        ])('should refuse %s %s, a day that does not exist, before writing', async (field, day) => {
          const before = await countOf('documents', 'kyc_case_id', kyc.id);

          const result = await upload({ 'Document type': 'PASSPORT', [field]: day });

          expect(result).toMatchObject({ type: 'Error', message: `${field} is not a real date.` });
          expect(await countOf('documents', 'kyc_case_id', kyc.id)).toBe(before);
        });
      });
    });

    it("should compute an individual's full_name from the first and last names", async () => {
      const rows = await dataSource
        .getCollection('individuals')
        .list(
          caller,
          new PaginatedFilter({ page: new Page(0, 3) }),
          new Projection('first_name', 'last_name', 'full_name'),
        );

      expect(rows).toHaveLength(3);
      rows.forEach(row => expect(row.full_name).toBe(`${row.first_name} ${row.last_name}`));
    });

    it('should count the waiting and overdue tasks of every segment queue in hub_counts', async () => {
      const queue = {
        waiting: expect.any(Number),
        overdue: expect.any(Number),
        hasDeadline: expect.any(Boolean),
      };

      const chart = await dataSource.renderChart(caller, 'hub_counts');

      expect(chart).toEqual({
        at: expect.any(String),
        queues: Object.fromEntries(Object.keys(SEGMENTS).map(key => [key, queue])),
      });
      expect(chart.queues.alerts_aml.waiting).toBeGreaterThan(0);
      expect(chart.queues.alerts_aml.hasDeadline).toBe(true);
    });

    it('should count the rows of every table in data_map, with none unavailable', async () => {
      const chart = await dataSource.renderChart(caller, 'data_map');
      const counted = chart.domains.flatMap(d => d.tables).filter(t => t.rows !== null);

      expect(chart.unavailable).toEqual([]);
      expect(chart.stats.tables).toBe(59);
      expect(counted).toHaveLength(59);
    });
  });
});
