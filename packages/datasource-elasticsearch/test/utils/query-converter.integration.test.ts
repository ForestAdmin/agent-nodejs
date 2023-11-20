import {
  Caller,
  ConditionTree,
  Operator,
  Page,
  PaginatedFilter,
  Projection,
  RecordData,
  Sort,
} from '@forestadmin/datasource-toolkit';

import ElasticsearchCollection from '../../src/collection';
import { createElasticsearchDataSource } from '../../src/index';
import ELASTICSEARCH_URL from '../helpers/connection-details';
import {
  createElasticsearchIndex,
  deleteElasticsearchIndex,
} from '../helpers/elastic-search-index-manager';

const dataset = [
  {
    id: 1,
    text: "If I fall, don't bring me back",
    user: 'jon',
    date: new Date(),
    nestedField: { type: 'ruby' },
  },
  {
    id: 2,
    text: 'Winter is coming',
    user: 'ned',
    date: new Date(),
    nestedField: { type: 'laravel' },
  },
  {
    id: 3,
    text: 'A Lannister always pays his debts',
    user: 'tyrion',
    date: new Date(),
    nestedField: { type: 'php' },
  },
  {
    id: 4,
    text: 'I am the blood of the dragon',
    user: 'daenerys',
    date: new Date(),
    nestedField: { type: 'python' },
  },
  {
    id: 5,
    text: "A girl is Arya Stark of Winterfell. And I'm going home",
    user: 'arya',
    date: new Date(),
    nestedField: { type: 'javascript' },
  },
  {
    id: 6,
    text: null,
    user: 'ilyn',
    date: new Date(),
    nestedField: { type: 'rust' },
  },
];

beforeAll(async () => {
  await createElasticsearchIndex('test-index', dataset);
});
afterAll(async () => {
  await deleteElasticsearchIndex('test-index');
});

describe('Utils > QueryConverter', () => {
  describe('ConditionTree', () => {
    describe('Operators', () => {
      it.each([
        [
          { field: 'text', operator: 'Present' as Operator } as unknown as ConditionTree,
          expect.not.arrayContaining([expect.objectContaining({ user: 'ilyn' })]),
          5,
        ],
        [
          { field: 'text', operator: 'Missing' as Operator } as unknown as ConditionTree,
          [{ user: 'ilyn' }],
          1,
        ],
        [
          {
            field: 'user',
            operator: 'Equal' as Operator,
            value: 'jon',
          } as unknown as ConditionTree,
          [{ user: 'jon' }],
          1,
        ],
        [
          { field: 'text', operator: 'Equal' as Operator, value: null } as unknown as ConditionTree,
          [{ user: 'ilyn' }],
          1,
        ],
        [
          {
            field: 'text',
            operator: 'Equal' as Operator,
            value: ['', null],
          } as unknown as ConditionTree,
          [{ user: 'ilyn' }],
          1,
        ],
        [
          {
            field: 'user',
            operator: 'NotIn' as Operator,
            value: ['tyrion', 'jon'],
          } as unknown as ConditionTree,
          expect.not.arrayContaining([
            expect.objectContaining({ user: 'tyrion' }),
            expect.objectContaining({ user: 'jon' }),
          ]),
          4,
        ],
        [
          {
            field: 'user',
            operator: 'Like' as Operator,
            value: 'yrio',
          } as unknown as ConditionTree,
          expect.not.arrayContaining([expect.objectContaining({ user: 'tyrion' })]),
          0,
        ],
        [
          {
            field: 'text',
            operator: 'Like' as Operator,
            value: '%debts',
          } as unknown as ConditionTree,
          [{ text: 'A Lannister always pays his debts' }],
          1,
        ],
        [
          {
            field: 'user',
            operator: 'Like' as Operator,
            value: 'n%',
          } as unknown as ConditionTree,
          [{ user: 'ned' }],
          1,
        ],
        [
          {
            field: 'user',
            operator: 'Like' as Operator,
            value: 'NED',
          } as unknown as ConditionTree,
          [],
          0,
        ],
        [
          {
            field: 'user',
            operator: 'ILike' as Operator,
            value: 'NED',
          } as unknown as ConditionTree,
          [{ user: 'ned' }],
          1,
        ],
        [
          {
            field: 'id',
            operator: 'LessThan' as Operator,
            value: 2,
          } as unknown as ConditionTree,
          [{ user: 'jon' }],
          1,
        ],
        [
          {
            field: 'id',
            operator: 'GreaterThan' as Operator,
            value: 4,
          } as unknown as ConditionTree,
          [{ user: 'ilyn' }, { user: 'arya' }],
          2,
        ],
        [
          {
            field: 'user',
            operator: 'NotContains' as Operator,
            value: 'ned',
          } as unknown as ConditionTree,
          expect.not.arrayContaining([expect.objectContaining({ user: 'ned' })]),
          5,
        ],
      ])(
        'for operator %s it should return %s',
        async (conditionTree: ConditionTree, expectedResult: RecordData[], lenght: number) => {
          const collection = (await (
            await createElasticsearchDataSource(ELASTICSEARCH_URL, configurator =>
              configurator.addCollectionFromIndex({ name: 'index', indexName: 'test-index' }),
            )(jest.fn())
          ).getCollection('index')) as ElasticsearchCollection;
          const paginatedFilter: PaginatedFilter = {
            conditionTree,
            search: '',
            searchExtended: false,
            segment: '',
            sort: [
              {
                field: '_id',
                ascending: false,
              },
            ] as unknown as Sort,
            page: {
              skip: 0,
              limit: 10,
            } as unknown as Page,
            override: jest.fn(),
            nest: jest.fn(),
            isNestable: true,
          };
          const result = await collection.list(
            null as unknown as Caller,
            paginatedFilter,
            new Projection('_id', 'user', 'text', 'id'),
          );
          expect(result).toMatchObject(expectedResult);
          expect(result.length).toBe(lenght);
        },
      );
    });
  });
});
