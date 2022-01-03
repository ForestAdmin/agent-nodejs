import {
  CollectionSchema,
  DataSource,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { SequelizeCollection } from '../src';

describe('SequelizeDataSource > Collection', () => {
  it('should instanciate properly', () => {
    const name = Symbol('name') as unknown as string;
    const dataSource = Symbol('dataSource') as unknown as DataSource;
    const schema = Symbol('schema') as unknown as CollectionSchema;
    const sequelize = Symbol('sequelize');
    const sequelizeCollection = new SequelizeCollection(name, dataSource, schema, sequelize);

    expect(sequelizeCollection).toBeDefined();
    expect(sequelizeCollection.name).toBe(name);
    expect(sequelizeCollection.dataSource).toBe(dataSource);
    expect(sequelizeCollection.schema).toBe(schema);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(sequelizeCollection['sequelize']).toBe(sequelize);
  });

  describe('getAction', () => {
    it('should return a known action', () => {
      const schema: CollectionSchema = {
        actions: [{ name: '__action__', scope: 'single' }],
      } as CollectionSchema;
      const sequelizeCollection = new SequelizeCollection(null, null, schema, null);

      // TODO: Match actual action when defined.
      expect(sequelizeCollection.getAction('__action__')).toBeNull();
    });

    it('should thrown with an unknown action name', () => {
      const schema: CollectionSchema = {
        actions: [{ name: '__action__', scope: 'single' }],
      } as CollectionSchema;
      const sequelizeCollection = new SequelizeCollection(null, null, schema, null);

      expect(() => sequelizeCollection.getAction('__no_such_action__')).toThrow(
        'Action "__no_such_action__" not found.',
      );
    });
  });

  describe('getById', () => {
    const setup = () => {
      const sequelizeCollection = new SequelizeCollection(null, null, null, null);
      const recordData = Symbol('recordData');
      const record = {
        get: jest.fn(() => recordData),
      };
      const findByPk = jest.fn().mockResolvedValue(record);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        findByPk,
      };

      return {
        findByPk,
        record,
        recordData,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.findByPk`', async () => {
      const { findByPk, recordData, sequelizeCollection } = setup();
      const id = [42];
      const projection: Projection = Symbol('projection') as unknown as Projection;

      await expect(sequelizeCollection.getById(id, projection)).resolves.toBe(recordData);
      expect(findByPk).toHaveBeenCalledWith(id[0], { attributes: projection });
    });

    it('should resolve with a plain record', async () => {
      const { record, recordData, sequelizeCollection } = setup();
      const id = [42];

      const result = await sequelizeCollection.getById(id, null);

      expect(record.get).toHaveBeenCalledWith({ plain: true });
      expect(result).toBe(recordData);
    });
  });

  describe('create', () => {
    const setup = () => {
      const sequelizeCollection = new SequelizeCollection(null, null, null, null);
      const recordData = Symbol('recordData');
      const bulkCreate = jest.fn().mockResolvedValue(recordData);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        bulkCreate,
      };

      return {
        bulkCreate,
        recordData,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.bulkCreate`', async () => {
      const { bulkCreate, recordData, sequelizeCollection } = setup();
      const data = Symbol('data') as unknown as RecordData[];

      await expect(sequelizeCollection.create(data)).resolves.toBe(recordData);
      expect(bulkCreate).toHaveBeenCalledWith(data);
    });
  });

  describe('list', () => {
    const setup = () => {
      const sequelizeCollection = new SequelizeCollection(null, null, null, null);
      const recordData = Symbol('recordData');
      const record = {
        get: jest.fn(() => recordData),
      };
      const findAll = jest.fn().mockResolvedValue([record]);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        findAll,
      };

      return {
        findAll,
        record,
        recordData,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.findAll`', async () => {
      const { findAll, recordData, sequelizeCollection } = setup();
      const filter = {};
      const projection = Symbol('projection') as unknown as Projection;

      const result = await sequelizeCollection.list(filter, projection);

      expect(result).toBeArrayOfSize(1);
      expect(result[0]).toBe(recordData);
      expect(findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: projection,
        }),
      );
    });

    it('should resolve with plain records', async () => {
      const { record, recordData, sequelizeCollection } = setup();
      const filter = {};

      const result = await sequelizeCollection.list(filter, null);

      expect(result).toBeArrayOfSize(1);
      expect(result[0]).toBe(recordData);
      expect(record.get).toHaveBeenCalledWith({ plain: true });
    });
  });

  describe('update', () => {
    const setup = () => {
      const sequelizeCollection = new SequelizeCollection(null, null, null, null);
      const recordData = Symbol('recordData');
      const update = jest.fn().mockResolvedValue(recordData);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      sequelizeCollection['model'] = {
        update,
      };

      return {
        update,
        recordData,
        sequelizeCollection,
      };
    };

    it('should delegate work to `sequelize.model.update`', async () => {
      const { update, sequelizeCollection } = setup();
      const patch = { field: '__value__' };
      const filter = {};

      await expect(sequelizeCollection.update(filter, patch)).resolves.toBe(null);

      expect(update).toHaveBeenCalledWith(
        patch,
        expect.objectContaining({ fields: Object.keys(patch) }),
      );
    });
  });
});
