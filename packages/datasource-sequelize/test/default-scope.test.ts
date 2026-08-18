import type SequelizeCollection from '../src/collection';
import type { Caller } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  ConditionTreeLeaf,
  Filter,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { DataTypes, Sequelize } from 'sequelize';

import { createSequelizeDataSource } from '../src/index';

describe('Relation whose target declares a defaultScope', () => {
  const caller: Caller = {} as Caller;

  async function setupCars({ scoped }: { scoped: boolean }) {
    const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

    const category = sequelize.define(
      'Category',
      { label: DataTypes.TEXT, archived: DataTypes.BOOLEAN },
      scoped ? { defaultScope: { where: { archived: false } } } : {},
    );
    const car = sequelize.define('Car', { name: DataTypes.TEXT });

    car.belongsTo(category, { as: 'category', foreignKey: 'categoryId' });

    await sequelize.sync({ force: true });

    await category.unscoped().bulkCreate([
      { id: 1, label: 'LIVE', archived: false },
      { id: 2, label: 'ARCHIVED', archived: true },
    ]);
    await car.bulkCreate([
      { name: 'CAR-live', categoryId: 1 },
      { name: 'CAR-archived', categoryId: 2 },
      { name: 'CAR-orphan', categoryId: null },
    ]);

    const datasource = await createSequelizeDataSource(sequelize)(jest.fn(), jest.fn());

    return {
      sequelize,
      collection: datasource.getCollection('Car') as SequelizeCollection,
    };
  }

  describe('list', () => {
    it('should keep every parent record when the relation is projected', async () => {
      const { sequelize, collection } = await setupCars({ scoped: true });

      const records = await collection.list(
        caller,
        new PaginatedFilter({}),
        new Projection('name', 'category:label'),
      );

      expect(records).toEqual([
        { name: 'CAR-live', category: { label: 'LIVE' } },
        { name: 'CAR-archived', category: null },
        { name: 'CAR-orphan', category: null },
      ]);

      await sequelize.close();
    });

    it('should return the related record when the target declares no defaultScope', async () => {
      const { sequelize, collection } = await setupCars({ scoped: false });

      const records = await collection.list(
        caller,
        new PaginatedFilter({}),
        new Projection('name', 'category:label'),
      );

      expect(records).toEqual([
        { name: 'CAR-live', category: { label: 'LIVE' } },
        { name: 'CAR-archived', category: { label: 'ARCHIVED' } },
        { name: 'CAR-orphan', category: null },
      ]);

      await sequelize.close();
    });

    it('should still filter on a scoped relation field', async () => {
      const { sequelize, collection } = await setupCars({ scoped: true });

      const records = await collection.list(
        caller,
        new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('category:label', 'Equal', 'LIVE'),
        }),
        new Projection('name'),
      );

      expect(records).toEqual([{ name: 'CAR-live' }]);

      await sequelize.close();
    });
  });

  describe('aggregate', () => {
    it('should count every parent record when the relation is projected', async () => {
      const { sequelize, collection } = await setupCars({ scoped: true });

      const results = await collection.aggregate(
        caller,
        new Filter({}),
        new Aggregation({ operation: 'Count', groups: [{ field: 'category:label' }] }),
      );

      expect(results).toEqual([
        { group: { 'category:label': null }, value: 2 },
        { group: { 'category:label': 'LIVE' }, value: 1 },
      ]);

      await sequelize.close();
    });
  });
});
