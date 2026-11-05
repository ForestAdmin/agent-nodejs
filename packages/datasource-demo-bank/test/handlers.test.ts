import type {
  ActionField,
  ActionFormElement,
  ActionResult,
  Caller,
  Collection,
  ConditionTree,
  DataSource,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createDemoBankDataSource } from '../src/index';
import { tables } from '../src/seed/schema';

const chartNames: string[] = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'charts.json'), 'utf8'),
);

// Seeding writes about 300,000 rows.
jest.setTimeout(120_000);

const caller = {
  id: 1,
  email: 'jest@example.com',
  firstName: 'Jest',
  lastName: 'Tester',
  team: 'Operations',
  role: 'Admin',
  tags: {},
  renderingId: 1,
  timezone: 'Europe/Paris',
} as unknown as Caller;
const PDF = Buffer.from('%PDF-1.4\n%%EOF');
const RESULT_TYPES = ['Success', 'Error', 'Webhook', 'File', 'Redirect'];
// How many rows matching a case's filter an action may refuse before one lets it do its work.
const CANDIDATES = 30;

const byId = (id: unknown) =>
  new Filter({ conditionTree: new ConditionTreeLeaf('id', 'Equal', id as string) });
const where = (field: string, value: unknown) => new ConditionTreeLeaf(field, 'Equal', value);
const status = (value: string) => where('status', value);
const both = (...trees: ConditionTree[]) => ConditionTreeFactory.intersect(...trees);
const company = where('customer:customer_type', 'BUSINESS');
// A case these actions may act on: any not decided yet (an OPEN one moves to IN_REVIEW). The earlier
// cases decide some of the seeded ones, so the open ones alone may run out.
const undecided = new ConditionTreeLeaf('status', 'NotIn', ['APPROVED', 'REJECTED']);

/** The ids of the first rows matching `tree`, by id. */
async function idsOf(collection: Collection, tree: ConditionTree, limit = CANDIDATES) {
  const rows = await collection.list(
    caller,
    new PaginatedFilter({
      conditionTree: tree,
      page: new Page(0, limit),
      sort: new Sort({ field: 'id', ascending: true }),
    }),
    new Projection('id'),
  );

  return rows.map(row => row.id);
}

/**
 * An alert in review whose outgoing payment is held, the state "Approve transfer" and "Reject
 * transfer" act on. Few seeded alerts are in it, and the actions before these release them, so
 * the test puts one there: the `nth` alert in review linked to a debit, its debit held.
 */
async function alertWithHeldPayment(dataSource: DataSource, nth: number) {
  const inReview = await idsOf(dataSource.getCollection('alerts'), status('IN_REVIEW'), 200);
  const links = await dataSource
    .getCollection('alert_transactions')
    .list(
      caller,
      new PaginatedFilter({ conditionTree: new ConditionTreeLeaf('alert_id', 'In', inReview) }),
      new Projection('alert_id', 'transaction_id'),
    );
  const debits = await dataSource.getCollection('transactions').list(
    caller,
    new PaginatedFilter({
      conditionTree: both(
        new ConditionTreeLeaf(
          'id',
          'In',
          links.map(link => link.transaction_id),
        ),
        where('direction', 'DEBIT'),
      ),
    }),
    new Projection('id'),
  );
  const debitIds = new Set(debits.map(row => row.id));
  const pairs = inReview
    .map(alertId => links.find(l => l.alert_id === alertId && debitIds.has(l.transaction_id)))
    .filter(Boolean);
  const { alert_id: alertId, transaction_id: transactionId } = pairs[nth];
  await dataSource
    .getCollection('transactions')
    .update(caller, byId(transactionId), { status: 'HELD' });

  return { ids: [alertId], setup: [] };
}

/**
 * A KYC case in review whose holder has an open screening hit, the state "Park for screening"
 * acts on. Few seeded cases are in it, and the actions before it decide them, so the test puts one
 * there: an open hit moved onto the holder of the first case in review.
 */
async function caseWithOpenHit(dataSource: DataSource) {
  const [kycId] = await idsOf(dataSource.getCollection('kyc_cases'), status('IN_REVIEW'), 1);
  const [kyc] = await dataSource
    .getCollection('kyc_cases')
    .list(
      caller,
      new PaginatedFilter({ conditionTree: where('id', kycId) }),
      new Projection('customer_id'),
    );
  const [member] = await dataSource.getCollection('customer_members').list(
    caller,
    new PaginatedFilter({
      conditionTree: both(
        where('customer_id', kyc.customer_id),
        new ConditionTreeLeaf('until', 'Missing'),
      ),
    }),
    new Projection('individual_id'),
  );
  const [hitId] = await idsOf(dataSource.getCollection('screening_hits'), status('OPEN'), 1);
  await dataSource
    .getCollection('screening_hits')
    .update(caller, byId(hitId), { individual_id: member.individual_id });

  return { ids: [kycId], setup: [] };
}

/** The input fields of a form, out of its pages and rows. */
function inputsOf(elements: ActionFormElement[]): ActionField[] {
  return elements.flatMap(element => {
    if (element.type !== 'Layout') return [element as ActionField];
    if (element.component === 'Page') return inputsOf(element.elements);
    if (element.component === 'Row') return inputsOf(element.fields);

    return [];
  });
}

/** A valid value for a required field the form leaves empty. */
async function valueFor(dataSource: DataSource, field: ActionField) {
  const [option] = (field as { options?: { value: unknown }[] }).options ?? [];
  if (option) return option.value;

  switch (field.type) {
    case 'Number':
      return 1;
    case 'Boolean':
      return true;
    case 'Date':
    case 'Dateonly':
      return '2026-01-15';
    case 'Enum':
      return field.enumValues[0];
    case 'EnumList':
      return [field.enumValues[0]];
    case 'StringList':
      return ['Jest'];
    case 'NumberList':
      return [1];
    case 'Json':
      return {};
    case 'File':
      return { mimeType: 'application/pdf', buffer: PDF, name: 'jest.pdf', charset: 'utf-8' };
    case 'FileList':
      return [{ mimeType: 'application/pdf', buffer: PDF, name: 'jest.pdf', charset: 'utf-8' }];

    case 'Collection': {
      const [id] = await idsOf(dataSource.getCollection(field.collectionName), undefined, 1);

      return [id];
    }

    default:
      return 'Jest value';
  }
}

/**
 * The values a user would submit: the form's defaults, `given`, and a valid value in every other
 * required field. The form is loaded again with them, for the fields that depend on others.
 */
async function formValues(
  dataSource: DataSource,
  collection: Collection,
  name: string,
  given: RecordData,
  filter?: Filter,
) {
  let data: RecordData = { ...given };

  // Each pass reads the form the previous one filled; a Collection field reads the database.
  /* eslint-disable no-await-in-loop, no-restricted-syntax */
  for (let pass = 0; pass < 2; pass += 1) {
    const fields = inputsOf(await collection.getForm(caller, name, data, filter));
    const next: RecordData = { ...given };

    for (const field of fields) {
      const known = data[field.label] ?? (field.value === '' ? undefined : field.value);

      if (known === undefined && field.isRequired) {
        next[field.label] = await valueFor(dataSource, field);
      } else if (known !== undefined && !(field.label in next)) {
        next[field.label] = known;
      }
    }

    data = next;
  }
  /* eslint-enable no-await-in-loop, no-restricted-syntax */

  return data;
}

type Case = {
  /** The rows the action is tried on, by id; none for a Global action. */
  rows?: ConditionTree;
  /** Form values the defaults would not make valid. */
  values?: RecordData;
  /** Puts rows in the state the action needs: their ids, and the results of the actions run. */
  prepare?: (dataSource: DataSource) => Promise<{ ids: unknown[]; setup: ActionResult[] }>;
  /** The result the action gives once it found a row it can work on. */
  expected?: ActionResult['type'];
  message?: RegExp;
};

const application = {
  Partner: 'Jest Handlers Partner',
  'Partner reference': 'JEST-HANDLERS-0001',
  'First name': 'Grace',
  'Last name': 'Handlerson',
  'Date of birth': '1985-03-09',
  Nationality: 'FR',
  Email: 'grace.handlerson@example.com',
  Phone: '+33 6 98 76 54 32',
  Address: '2 rue de Rivoli',
  'Postal code': '75001',
  City: 'Paris',
  Country: 'FR',
  'Employment status': 'EMPLOYED',
  Occupation: 'Analyst',
  'Income band': 'FROM_40K_TO_70K',
  'Source of funds': 'SALARY',
  'Expected monthly income': 3000,
  'Expected monthly spending': 2000,
};

/** Every Smart Action, collection by collection, in declaration order: which rows it works on. */
const CASES: Record<string, Record<string, Case>> = {
  accounts: {
    'Freeze account': { rows: status('ACTIVE'), message: /frozen/ },
    'Unfreeze account': { rows: status('FROZEN'), message: /is active again\.$/ },
  },
  alerts: {
    'Start review': {
      rows: status('OPEN'),
      message: /is in review, assigned to jest@example\.com/,
    },
    'Check device and IP': { rows: status('OPEN'), message: /simulated/ },
    'Call the customer': { rows: status('OPEN'), message: /simulated/ },
    'Send for a second look': { rows: status('OPEN'), message: /second look/ },
    'Clear alert': { rows: status('OPEN'), message: /cleared/ },
    Escalate: { rows: status('OPEN'), message: /escalated to/ },
    'Revoke device': { rows: status('IN_REVIEW'), message: /revoked/ },
    'Freeze account': { rows: status('OPEN'), message: /frozen/ },
    'Unfreeze account': { rows: status('OPEN'), message: /is active again\.$/ },
    'Recall transfer': { rows: status('IN_REVIEW'), message: /^Recall / },
    'Refund the customer (PSD2)': { rows: status('IN_REVIEW'), message: /refunded/ },
    // Each takes its own alert, so the first cannot leave the second without a held payment.
    'Approve transfer': {
      prepare: ds => alertWithHeldPayment(ds, 0),
      message: /approved and sent\.$/,
    },
    'Reject transfer': {
      prepare: ds => alertWithHeldPayment(ds, 1),
      message: /rejected/,
    },
  },
  chargebacks: {
    'Block linked card': { rows: status('INITIATED'), message: /blocked/ },
    'Request cardholder info': { rows: status('INITIATED'), message: /sent to the cardholder/ },
    'File with network': { rows: status('INITIATED'), message: /filed with/ },
    'Accept Liability & Refund Customer': { rows: status('INITIATED'), message: /refunded/ },
    'File pre-arbitration': { rows: status('REPRESENTED'), message: /pre-arbitration filed/ },
    'Accept representment': { rows: status('REPRESENTED'), message: /lost/ },
  },
  customers: {
    'Change preferred language': { rows: status('ACTIVE') },
    'Start the day': { message: /^The day starts: \d+ new cases\.$/ },
  },
  dispute_requests: {
    'Ask to contact the merchant': { rows: status('NEW'), message: /waits on the customer/ },
    'Route dispute': { rows: status('NEW'), message: /routed/ },
  },
  documents: {
    'Verify document': { rows: undefined, message: /^ID check / },
    'Check against the register': {
      rows: both(
        new ConditionTreeLeaf('document_type', 'In', [
          'COMPANY_REGISTRATION',
          'ARTICLES_OF_ASSOCIATION',
          'UBO_DECLARATION',
        ]),
        new ConditionTreeLeaf('business_id', 'Present'),
        new ConditionTreeLeaf('kyc_case_id', 'Present'),
      ),
      message: /register/,
    },
    Accept: { rows: new ConditionTreeLeaf('check_result', 'In', ['FAILED', 'MANUAL_REVIEW']) },
    'Reject with a reason': { rows: undefined, message: /rejected/ },
  },
  investigations: {
    Assign: { rows: status('OPEN'), message: /assigned to jest@example\.com\.$/ },
    'Request information': { rows: status('OPEN'), message: /sent to the customer/ },
    'Request enhanced due diligence': { rows: status('IN_PROGRESS') },
    'Draft SAR': { rows: status('IN_PROGRESS'), expected: 'File' },
    'File SAR': { rows: status('PENDING_MLRO'), message: /filed with TRACFIN/ },
    'Send back to the analyst': { rows: status('PENDING_MLRO'), message: /back in the analysts/ },
    'Close without SAR': { rows: status('IN_PROGRESS'), message: /closed without SAR/ },
    'Exit relationship': { rows: status('IN_PROGRESS'), message: /^Investigation closed/ },
  },
  kyc_cases: {
    'Check documents': { rows: status('OPEN') },
    'Screen against sanctions lists': { rows: status('OPEN'), message: /simulated/ },
    'Verify document': { rows: status('OPEN'), message: /^ID check / },
    'Request ID document': { rows: status('OPEN'), message: /new ID document asked/ },
    'Request company documents': { rows: both(undecided, company), message: /sent/ },
    'Request missing documents': { rows: status('OPEN'), message: /sent in the app/ },
    'Check the company register': { rows: both(status('WAITING_CUSTOMER'), company) },
    'Send for senior sign-off': { rows: status('OPEN'), message: /sign-off/ },
    'Park for screening': { prepare: caseWithOpenHit, message: /parked/ },
    'Hand to a person': { rows: status('OPEN'), message: /waits for a person/ },
    'Approve card acceptance': { rows: both(undecided, company), message: /approved/ },
    'Set a reserve': {
      rows: both(undecided, company),
      values: { 'Share held (%)': 10, 'Days held': 120 },
    },
    'Approve KYC': {
      rows: status('IN_REVIEW'),
      // The case picked decides how the message ends: a customer still onboarding becomes active,
      // and a new customer's (an ONBOARDING case's) first account opens.
      message: /approved\.( .+ is now an active customer\.( Account opened: .+\.)?)?$/,
    },
    'Rate the risk': { rows: status('IN_REVIEW'), message: /rated/ },
    'Approve KYC - Low risk': {
      // Cases a person has just rated LOW; the approval still wants their papers verified.
      prepare: async dataSource => {
        const kycCases = dataSource.getCollection('kyc_cases');
        const ids = await idsOf(kycCases, status('IN_REVIEW'), 10);
        const setup = await Promise.all(
          ids.map(id =>
            kycCases.execute(caller, 'Rate the risk', { 'Risk rating': 'LOW' }, byId(id)),
          ),
        );

        return { ids, setup };
      },
      message: /approved/,
    },
    'Approve KYC - Medium or High': { rows: status('PENDING_APPROVAL'), message: /approved/ },
    'Reject KYC': { rows: status('IN_REVIEW'), message: /rejected\./ },
    'Change preferred language': { rows: status('IN_REVIEW') },
    'Submit application': { values: application, message: /^Application KYC-/ },
    'Upload document': {
      rows: status('IN_REVIEW'),
      values: {
        'Document type': 'PASSPORT',
        File: { mimeType: 'application/pdf', buffer: PDF, name: 'passport.pdf', charset: 'utf-8' },
      },
    },
    'Send new applications': { message: /new applications sent\.$/ },
    'Reset the demo cases': { message: /^Demo cases reset: KYC-DEMO-0001/ },
  },
  outgoing_transfers: {
    'Check the payee': { rows: where('validation_status', 'PENDING') },
    'Call customer back': { rows: where('validation_status', 'PENDING') },
    'Approve transfer': { rows: where('validation_status', 'PENDING'), message: /approved/ },
    'Reject transfer': { rows: where('validation_status', 'PENDING'), message: /rejected/ },
  },
  sar_reports: {
    'Record TRACFIN answer': { rows: status('SUBMITTED'), message: /answer recorded/ },
  },
  screening_hits: {
    'Discard as false positive': { rows: status('OPEN'), message: /false positive/ },
    'Confirm true match': { rows: status('OPEN'), message: /confirmed as a sanctions match/ },
    'Release held payment': {
      // A payment-screening hit discarded just now: its payment is still held.
      prepare: async dataSource => {
        const hits = dataSource.getCollection('screening_hits');
        const [id] = await idsOf(hits, both(status('OPEN'), where('trigger', 'PAYMENT')), 1);
        const discarded = await hits.execute(
          caller,
          'Discard as false positive',
          await formValues(dataSource, hits, 'Discard as false positive', {}, byId(id)),
          byId(id),
        );

        return { ids: [id], setup: [discarded] };
      },
    },
    'Escalate to MLRO': { rows: status('TRUE_MATCH'), message: /sent to the MLRO/ },
  },
  sepa_disputes: {
    'Escalate to fraud': { rows: status('OPEN') },
    'Ask the customer for consent': { rows: status('OPEN'), message: /consent/ },
    'Record the customer’s answer': { rows: status('WAITING_CUSTOMER'), message: /answered/ },
    'Accept and return funds': { rows: status('OPEN'), message: /sent back/ },
    'Refuse with a reason': { rows: status('OPEN'), message: /refused/ },
  },
};

/** The result a case's action gives once it found a row it can work on. */
function expectedResult({ expected, message }: Case) {
  return {
    type: expected ?? 'Success',
    ...(message ? { message: expect.stringMatching(message) } : {}),
  };
}

const ACTION_CASES = Object.entries(CASES).flatMap(([collection, actions]) =>
  Object.entries(actions).map(([action, spec]) => ({ collection, action, spec })),
);

describe('the demo bank once booted', () => {
  const cwd = process.cwd();
  let folder: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    // The data source seeds db.sqlite in the current folder.
    folder = mkdtempSync(path.join(tmpdir(), 'demo-bank-handlers-'));
    process.chdir(folder);
    dataSource = await createDemoBankDataSource()(() => {}, jest.fn().mockResolvedValue(undefined));
  });

  afterAll(() => {
    process.chdir(cwd);
    rmSync(folder, { recursive: true, force: true });
  });

  describe('computed fields', () => {
    // A field the data source adds: not a column of the data model, not a relation.
    const computedOf = (collection: Collection) =>
      Object.entries(collection.schema.fields)
        .filter(([, field]) => field.type === 'Column')
        .map(([name]) => name)
        .filter(name => !tables[collection.name].fields.some(f => f.name === name));

    it('should find computed fields on the customized collections', () => {
      const withComputed = dataSource.collections.filter(c => computedOf(c).length);

      expect(withComputed.map(c => c.name)).toEqual(
        expect.arrayContaining(['individuals', 'businesses', 'documents', 'alerts', 'kyc_cases']),
      );
    });

    it.each(Object.keys(tables).sort())(
      'should compute every added field of %s on its first rows',
      async name => {
        const collection = dataSource.getCollection(name);
        const fields = computedOf(collection);

        const rows = await collection.list(
          caller,
          new PaginatedFilter({ page: new Page(0, 5) }),
          new Projection(...fields).withPks(collection),
        );

        expect(rows.length).toBeGreaterThan(0);
        fields.forEach(field => expect(rows.some(row => row[field] !== undefined)).toBe(true));
      },
    );
  });

  describe('charts', () => {
    // The 22 API charts of the data source (index.test.ts checks the list).
    it.each(chartNames)('should render the data source chart %s', async name => {
      await expect(dataSource.renderChart(caller, name)).resolves.toEqual(expect.anything());
    });

    it.each(['senior', 'simplified'])('should render the demo guide of the %s desk', async desk => {
      await expect(dataSource.renderChart(caller, 'demo_guide', { desk })).resolves.toEqual(
        expect.anything(),
      );
    });

    it('should count the tables and the queues in feature_facts, nothing else', async () => {
      const facts = (await dataSource.renderChart(caller, 'feature_facts')) as {
        records: Record<string, number>;
      };

      expect(Object.keys(facts).sort()).toEqual(['at', 'queues', 'records']);
      expect(facts.records.customers).toBeGreaterThan(0);
    });

    it('should render the demo guide of a showcase case', async () => {
      const kycCases = dataSource.getCollection('kyc_cases');
      const [id] = await idsOf(kycCases, where('reference', 'KYC-DEMO-0001'), 1);

      await expect(
        dataSource.renderChart(caller, 'demo_guide', { id: String(id) }),
      ).resolves.toEqual(expect.anything());
    });
  });

  describe('Smart Actions', () => {
    it('should have a case for every Smart Action, in declaration order', () => {
      const declared = Object.fromEntries(
        dataSource.collections
          .map(c => [c.name, Object.keys(c.schema.actions)])
          .filter(([, names]) => names.length),
      );
      const cased = Object.fromEntries(
        Object.entries(CASES).map(([name, actions]) => [name, Object.keys(actions)]),
      );

      expect(cased).toStrictEqual(declared);
      expect(ACTION_CASES).toHaveLength(73);
    });

    it.each(ACTION_CASES)(
      'should run "$action" on $collection without throwing',
      async ({ collection: name, action, spec }) => {
        const collection = dataSource.getCollection(name);
        const { scope } = collection.schema.actions[action];
        let ids: unknown[] = [undefined];
        let setup: ActionResult[] = [];
        if (spec.prepare) ({ ids, setup } = await spec.prepare(dataSource));
        else if (scope !== 'Global') ids = await idsOf(collection, spec.rows);

        const results: ActionResult[] = [];

        // The rows one by one, until one lets the action do its work.
        // eslint-disable-next-line no-restricted-syntax
        for (const id of ids) {
          const filter = id === undefined ? undefined : byId(id);
          // eslint-disable-next-line no-await-in-loop
          const values = await formValues(
            dataSource,
            collection,
            action,
            spec.values ?? {},
            filter,
          );
          // eslint-disable-next-line no-await-in-loop
          const result = await collection.execute(caller, action, values, filter);
          results.push(result);
          if (result.type !== 'Error') break;
        }

        const last = results[results.length - 1];

        setup.forEach(result => expect(result).toMatchObject({ type: 'Success' }));
        expect(results.length).toBeGreaterThan(0);
        results.forEach(result => expect(RESULT_TYPES).toContain(result.type));
        expect(last).toMatchObject(expectedResult(spec));
      },
    );
  });

  describe('"Due in (days)" of a request for information', () => {
    const requests = async () =>
      (
        await dataSource
          .getCollection('information_requests')
          .list(caller, new PaginatedFilter({}), new Projection('id'))
      ).length;

    it.each([
      ['Request information', 'investigations', 'OPEN', 100_000],
      ['Request information', 'investigations', 'OPEN', -3],
      ['Request information', 'investigations', 'OPEN', 2.5],
      ['Request cardholder info', 'chargebacks', 'INITIATED', 0],
      ['Request cardholder info', 'chargebacks', 'INITIATED', 366],
    ])(
      'should refuse "%s" on %s with status %s, due in %p days, before sending anything',
      async (action, name, state, dueIn) => {
        const collection = dataSource.getCollection(name);
        const [id] = await idsOf(collection, status(state), 1);
        const before = await requests();

        const result = await collection.execute(
          caller,
          action,
          { Questions: 'Jest question', 'Due in (days)': dueIn },
          byId(id),
        );

        expect(result).toMatchObject({
          type: 'Error',
          message: 'Due in (days) must be a whole number of days, from 1 to 365.',
        });
        expect(await requests()).toBe(before);
      },
    );
  });
});
