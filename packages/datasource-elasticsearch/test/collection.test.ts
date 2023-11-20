/* eslint-disable max-len */
/* eslint-disable jest/no-commented-out-tests */
import { Client } from '@elastic/elasticsearch';
import MockClient from '@elastic/elasticsearch-mock';
import { DataSource } from '@forestadmin/datasource-toolkit';

import { ElasticsearchCollection } from '../src';
import ModelElasticsearch from '../src/model-builder/model';

describe('ElasticsearchDataSource > Collection', () => {
  const makeConstructorParams = () => {
    const dataSource = Symbol('datasource') as unknown as DataSource;
    const name = '__collection__';

    const mockClient = new MockClient();
    const client = new Client({
      node: 'http://localhost:9200',
      Connection: mockClient.getConnection(),
    });

    const model = new ModelElasticsearch(client, name, ['indexPattern'], ['alias'], {
      properties: { name: { type: 'integer' } },
    });

    const elasticsearchCollection = new ElasticsearchCollection(
      dataSource,
      model,
      jest.fn(),
      client,
    );

    return {
      dataSource,
      name,
      client,
      mockClient,
      model,
      elasticsearchCollection,
    };
  };

  it('should instantiate properly', () => {
    const { dataSource, name, elasticsearchCollection, model } = makeConstructorParams();

    expect(elasticsearchCollection).toBeDefined();
    expect(elasticsearchCollection.name).toBe(name);
    expect(elasticsearchCollection.dataSource).toBe(dataSource);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(elasticsearchCollection['internalModel']).toBe(model);

    expect(elasticsearchCollection.nativeDriver).toBeDefined();
  });

  // describe('create', () => {
  // });

  // describe('list', () => {
  // mockClient.add({
  //   method: 'POST',
  //   path: '/test/_search'
  // }, () => {
  //   return {
  //     hits: {
  //       total: {
  //         value: 1,
  //         relation: 'eq'
  //       },
  //       hits: [
  //         { _source: { foo: 'bar' } }
  //       ]
  //     }
  //   }
  // })
  // });

  // describe('update', () => {
  // });

  // describe('delete', () => {
  // });

  // describe('aggregate', () => {
  //   const setup = (dialect?: string) => {
  //     const { dataSource, name, sequelize } = makeConstructorParams(dialect);

  //     const model = sequelize.define('model', {
  //       __field__: {
  //         type: DataTypes.NUMBER,
  //         field: '__field__',
  //       },
  //       __group_field__: {
  //         type: DataTypes.STRING,
  //         field: '__group_field__',
  //       },
  //       renamed__field__: {
  //         type: DataTypes.STRING,
  //         field: 'another__field__',
  //       },
  //       date__field__: {
  //         type: DataTypes.DATE,
  //         field: 'date__field__',
  //       },
  //     });

  //     const relation = sequelize.define('relation', {
  //       as__field__: {
  //         type: DataTypes.STRING,
  //         field: 'as__field__',
  //       },
  //       renamed__as__field__: {
  //         type: DataTypes.STRING,
  //         field: 'another__as__field__',
  //       },
  //     });

  //     const findAll = jest.fn().mockResolvedValue([
  //       {
  //         __aggregate__: '123',
  //         __group_field____grouped__: '__group_field__:value',
  //         renamed__field____grouped__: 'renamed__field__:value',
  //         'relations:as__field____grouped__': 'relations:as__field__:value',
  //         'relations:renamed__as__field____grouped__': 'relations:renamed__as__field__:value',
  //         date__field____grouped__: new Date('2000-10-01'),
  //       },
  //     ]);

  //     model.hasMany(relation);

  //     model.findAll = findAll;

  //     const sequelizeCollection = new SequelizeCollection(name, dataSource, model);

  //     return {
  //       findAll,
  //       sequelize,
  //       sequelizeCollection,
  //       model,
  //     };
  //   };

  //   describe('without aggregate field', () => {
  //     it('should aggregate on *', async () => {
  //       const { findAll, sequelizeCollection } = setup();
  //       const aggregation = new Aggregation({
  //         operation: 'Sum',
  //       });
  //       const filter = new Filter({});

  //       await expect(
  //         sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //       ).resolves.toEqual([{ group: {}, value: 123 }]);

  //       expect(findAll).toHaveBeenCalledTimes(1);
  //       expect(findAll).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           attributes: [[{ args: [{ col: '*' }], fn: 'SUM' }, '__aggregate__']],
  //         }),
  //       );
  //     });
  //   });

  //   describe('with aggregate field', () => {
  //     it('should aggregate on field', async () => {
  //       const { findAll, sequelizeCollection } = setup();
  //       const aggregation = new Aggregation({
  //         field: '__field__',
  //         operation: 'Sum',
  //       });
  //       const filter = new Filter({});

  //       await expect(
  //         sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //       ).resolves.toEqual([{ group: {}, value: 123 }]);

  //       expect(findAll).toHaveBeenCalledTimes(1);
  //       expect(findAll).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           attributes: [[{ args: [{ col: '"model"."__field__"' }], fn: 'SUM' }, '__aggregate__']],
  //         }),
  //       );
  //     });

  //     describe('with Count operation', () => {
  //       it('should aggregate on *', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           field: '__field__',
  //           operation: 'Count',
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([{ group: {}, value: 123 }]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             attributes: [[{ args: [{ col: '*' }], fn: 'COUNT' }, '__aggregate__']],
  //           }),
  //         );
  //       });
  //     });

  //     describe('when field name is different as column', () => {
  //       it('should aggregate properly', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           field: 'renamed__field__',
  //           operation: 'Sum',
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([{ group: {}, value: '123' }]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             attributes: [
  //               [{ args: [{ col: '"model"."another__field__"' }], fn: 'SUM' }, '__aggregate__'],
  //             ],
  //           }),
  //         );
  //       });
  //     });

  //     describe('when aggregate field is on relation', () => {
  //       describe('on count', () => {
  //         it('should count on *', async () => {
  //           const { findAll, sequelizeCollection } = setup();
  //           const aggregation = new Aggregation({
  //             field: 'relations:undefined',
  //             operation: 'Count',
  //           });
  //           const filter = new Filter({});

  //           await expect(
  //             sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //           ).resolves.toEqual([{ group: {}, value: 123 }]);

  //           expect(findAll).toHaveBeenCalledTimes(1);
  //           expect(findAll).toHaveBeenCalledWith(
  //             expect.objectContaining({
  //               attributes: [[{ args: [{ col: '*' }], fn: 'COUNT' }, '__aggregate__']],
  //             }),
  //           );
  //         });
  //       });
  //     });
  //   });

  //   describe('with filter', () => {
  //     it('should add filter to where clause', async () => {
  //       const { findAll, sequelizeCollection } = setup();
  //       const aggregation = new Aggregation({
  //         operation: 'Count',
  //       });
  //       const filter = new Filter({
  //         conditionTree: new ConditionTreeLeaf('id', 'Equal', 42),
  //       });

  //       await expect(
  //         sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //       ).resolves.toEqual([{ group: {}, value: 123 }]);

  //       expect(findAll).toHaveBeenCalledTimes(1);
  //       expect(findAll).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           where: {
  //             id: { [Op.eq]: 42 },
  //           },
  //         }),
  //       );
  //     });
  //   });

  //   describe('with groups', () => {
  //     it('should compute group properly', async () => {
  //       const { findAll, sequelizeCollection } = setup();
  //       const aggregation = new Aggregation({
  //         operation: 'Count',
  //         groups: [{ field: '__group_field__' }],
  //       });
  //       const filter = new Filter({});

  //       await expect(
  //         sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //       ).resolves.toEqual([{ group: { __group_field__: '__group_field__:value' }, value: 123 }]);

  //       expect(findAll).toHaveBeenCalledTimes(1);
  //       expect(findAll).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           attributes: expect.arrayContaining([
  //             [{ col: '"model"."__group_field__"' }, '__group_field____grouped__'],
  //           ]),
  //           group: ['__group_field____grouped__'],
  //         }),
  //       );
  //     });

  //     describe('when field name is different as column', () => {
  //       it('should compute group properly', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           operation: 'Count',
  //           groups: [{ field: 'renamed__field__' }],
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([
  //           { group: { renamed__field__: 'renamed__field__:value' }, value: 123 },
  //         ]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             attributes: expect.arrayContaining([
  //               [{ col: '"model"."another__field__"' }, 'renamed__field____grouped__'],
  //             ]),
  //             group: ['renamed__field____grouped__'],
  //           }),
  //         );
  //       });
  //     });

  //     describe('when group have relation', () => {
  //       it('should aggregate properly', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           operation: 'Count',
  //           groups: [{ field: 'relations:as__field__' }],
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([
  //           {
  //             group: {
  //               'relations:as__field__': 'relations:as__field__:value',
  //             },
  //             value: 123,
  //           },
  //         ]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             attributes: expect.arrayContaining([
  //               [{ col: '"relations"."as__field__"' }, 'relations:as__field____grouped__'],
  //             ]),
  //             group: ['relations:as__field____grouped__'],
  //           }),
  //         );
  //       });

  //       it('should add relation to include clause', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           operation: 'Count',
  //           groups: [{ field: 'relations:as__field__' }],
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([
  //           {
  //             group: {
  //               'relations:as__field__': 'relations:as__field__:value',
  //             },
  //             value: 123,
  //           },
  //         ]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             include: [
  //               {
  //                 association: 'relations',
  //                 include: [],
  //                 attributes: [],
  //               },
  //             ],
  //           }),
  //         );
  //       });

  //       describe('when field name is different as column', () => {
  //         it('should aggregate properly', async () => {
  //           const { findAll, sequelizeCollection } = setup();
  //           const aggregation = new Aggregation({
  //             operation: 'Count',
  //             groups: [{ field: 'relations:renamed__as__field__' }],
  //           });
  //           const filter = new Filter({});

  //           await expect(
  //             sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //           ).resolves.toEqual([
  //             {
  //               group: {
  //                 'relations:renamed__as__field__': 'relations:renamed__as__field__:value',
  //               },
  //               value: 123,
  //             },
  //           ]);

  //           expect(findAll).toHaveBeenCalledTimes(1);
  //           expect(findAll).toHaveBeenCalledWith(
  //             expect.objectContaining({
  //               attributes: expect.arrayContaining([
  //                 [
  //                   { col: '"relations"."another__as__field__"' },
  //                   'relations:renamed__as__field____grouped__',
  //                 ],
  //               ]),
  //               group: ['relations:renamed__as__field____grouped__'],
  //             }),
  //           );
  //         });
  //       });

  //       describe('when dialect is mssql', () => {
  //         it('should add field to group', async () => {
  //           const { findAll, sequelizeCollection } = setup('mssql');

  //           const aggregation = new Aggregation({
  //             operation: 'Count',
  //             groups: [{ field: '__group_field__' }],
  //           });
  //           const filter = new Filter({});

  //           await expect(
  //             sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //           ).resolves.toEqual([
  //             { group: { __group_field__: '__group_field__:value' }, value: 123 },
  //           ]);

  //           expect(findAll).toHaveBeenCalledTimes(1);
  //           expect(findAll).toHaveBeenCalledWith(
  //             expect.objectContaining({
  //               attributes: expect.arrayContaining([
  //                 [{ col: '[model].[__group_field__]' }, '__group_field____grouped__'],
  //               ]),
  //               group: ['[model].[__group_field__]'],
  //             }),
  //           );
  //         });
  //       });
  //     });

  //     describe('when group have date operations', () => {
  //       it('should group properly', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           operation: 'Count',
  //           groups: [{ field: 'date__field__', operation: 'Day' }],
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([
  //           // date should be serialize in iso string
  //           { group: { date__field__: '2000-10-01T00:00:00.000Z' }, value: 123 },
  //         ]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             attributes: expect.arrayContaining([
  //               [
  //                 {
  //                   args: [
  //                     { args: ['day', { col: '"model"."date__field__"' }], fn: 'DATE_TRUNC' },
  //                     'YYYY-MM-DD',
  //                   ],
  //                   fn: 'TO_CHAR',
  //                 },
  //                 'date__field____grouped__',
  //               ],
  //             ]),
  //             group: ['date__field____grouped__'],
  //           }),
  //         );
  //       });

  //       describe('when dialect is mssql', () => {
  //         it('should add date aggregation to group', async () => {
  //           const { findAll, sequelizeCollection } = setup('mssql');

  //           const aggregation = new Aggregation({
  //             operation: 'Count',
  //             groups: [{ field: 'date__field__', operation: 'Day' }],
  //           });
  //           const filter = new Filter({});

  //           await expect(
  //             sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //           ).resolves.toEqual([
  //             {
  //               // date should be serialize in iso string
  //               group: { date__field__: '2000-10-01T00:00:00.000Z' },
  //               value: 123,
  //             },
  //           ]);

  //           const aggregateFunction = {
  //             fn: 'CONVERT',
  //             args: [{ val: 'varchar(10)' }, { col: '[model].[date__field__]' }, 23],
  //           };

  //           expect(findAll).toHaveBeenCalledTimes(1);
  //           expect(findAll).toHaveBeenCalledWith(
  //             expect.objectContaining({
  //               attributes: expect.arrayContaining([
  //                 [aggregateFunction, 'date__field____grouped__'],
  //               ]),
  //               group: [aggregateFunction],
  //             }),
  //           );
  //         });
  //       });
  //     });
  //   });

  //   describe('on sort', () => {
  //     describe('when dialect is postgres', () => {
  //       it('should sort on aggregate by default', async () => {
  //         const { findAll, sequelizeCollection } = setup();
  //         const aggregation = new Aggregation({
  //           operation: 'Count',
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([{ group: {}, value: 123 }]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             order: [[{ col: '__aggregate__' }, 'DESC NULLS LAST']],
  //           }),
  //         );
  //       });
  //     });

  //     describe('when dialect is mssql', () => {
  //       it('should sort on aggregate by default', async () => {
  //         const { findAll, sequelizeCollection } = setup('mssql');
  //         const aggregation = new Aggregation({
  //           operation: 'Count',
  //         });
  //         const filter = new Filter({});

  //         await expect(
  //           sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //         ).resolves.toEqual([{ group: {}, value: 123 }]);

  //         expect(findAll).toHaveBeenCalledTimes(1);
  //         expect(findAll).toHaveBeenCalledWith(
  //           expect.objectContaining({
  //             order: [[{ fn: 'COUNT', args: [{ col: '*' }] }, 'DESC']],
  //           }),
  //         );
  //       });
  //     });

  //     it('should sort on aggregate by default', async () => {
  //       const { findAll, sequelizeCollection } = setup('mysql');
  //       const aggregation = new Aggregation({
  //         operation: 'Count',
  //       });
  //       const filter = new Filter({});

  //       await expect(
  //         sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation),
  //       ).resolves.toEqual([{ group: {}, value: 123 }]);

  //       expect(findAll).toHaveBeenCalledTimes(1);
  //       expect(findAll).toHaveBeenCalledWith(
  //         expect.objectContaining({
  //           order: [[{ col: '__aggregate__' }, 'DESC']],
  //         }),
  //       );
  //     });
  //   });

  //   describe('with limit', () => {
  //     it('should add limit to query', async () => {
  //       const { findAll, sequelizeCollection } = setup();
  //       const aggregation = new Aggregation({
  //         operation: 'Count',
  //       });
  //       const filter = new Filter({});
  //       const limit = 1;

  //       await expect(
  //         sequelizeCollection.aggregate(factories.caller.build(), filter, aggregation, limit),
  //       ).resolves.not.toThrow();

  //       expect(findAll).toHaveBeenCalledTimes(1);
  //       expect(findAll).toHaveBeenCalledWith(expect.objectContaining({ limit }));
  //     });
  //   });
  // });
});
