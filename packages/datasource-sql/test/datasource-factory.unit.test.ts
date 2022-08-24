import { DataSource, Logger } from '@forestadmin/datasource-toolkit';

import { Builder, Model } from '../src/utils/types';
import SqlDataSourceFactory from '../src/datasource-factory';

class MyBuilder implements Builder {
  models: { [p: string]: Model };
  logger?: Logger;

  buildDataSource(): DataSource {
    return undefined;
  }

  defineModel(): Promise<void> {
    throw new Error();
  }

  defineRelation(): Promise<void> {
    return Promise.resolve();
  }

  getRelatedTables(): Promise<string[]> {
    return Promise.resolve([]);
  }

  getTableNames(): Promise<string[]> {
    return Promise.resolve([]);
  }
}

describe('SqlDataSourceFactory > Unit', () => {
  describe('when defining a model throw an error', () => {
    it('should display a log message and does not create its relation', async () => {
      const myBuilder = new MyBuilder();
      myBuilder.defineModel = jest.fn().mockImplementation(() => {
        throw new Error('Error Message');
      });
      myBuilder.logger = jest.fn();
      myBuilder.getTableNames = jest.fn().mockReturnValue(['MyTable']);
      myBuilder.defineRelation = jest.fn();
      myBuilder.getRelatedTables = jest.fn().mockReturnValue(['MyTable']);

      await SqlDataSourceFactory.build(myBuilder);

      expect(myBuilder.logger).toHaveBeenCalledWith(
        'Warn',
        'Skipping table "MyTable" and its relations because of error: Error Message',
      );
      expect(myBuilder.defineRelation).not.toHaveBeenCalled();
    });

    describe('when there are many tables and a model with an error', () => {
      it('creates all the models and the relations when there is no error', async () => {
        const myBuilder = new MyBuilder();
        myBuilder.logger = jest.fn();
        myBuilder.defineRelation = jest.fn();
        myBuilder.getTableNames = jest.fn().mockReturnValue(['TableWithError', 'TableWithNoError']);
        myBuilder.defineModel = jest.fn().mockImplementation((tableName: string) => {
          if (tableName === 'TableWithError') {
            throw new Error('Error Message');
          }
        });
        myBuilder.getRelatedTables = jest.fn().mockImplementation((tableName: string) => {
          if (tableName === 'TableWithError') {
            return ['TableWithError'];
          }

          return ['TableWithNoError', 'AndOtherTable'];
        });

        await SqlDataSourceFactory.build(myBuilder);

        expect(myBuilder.logger).toHaveBeenCalledTimes(1);

        expect(myBuilder.defineRelation).toHaveBeenCalledWith('TableWithNoError');
        expect(myBuilder.defineRelation).toHaveBeenCalledTimes(1);
      });

      describe('when a related table has an error', () => {
        it('should does not create the relation', async () => {
          const myBuilder = new MyBuilder();
          myBuilder.logger = jest.fn();
          myBuilder.defineRelation = jest.fn();
          myBuilder.getTableNames = jest
            .fn()
            .mockReturnValue(['TableWithError', 'TableWithNoError']);
          myBuilder.defineModel = jest.fn().mockImplementation((tableName: string) => {
            if (tableName === 'TableWithError') {
              throw new Error('Error Message');
            }
          });
          myBuilder.getRelatedTables = jest.fn().mockImplementation((tableName: string) => {
            if (tableName === 'TableWithError') {
              return ['TableWithError'];
            }

            return ['TableWithNoError', 'TableWithError'];
          });

          await SqlDataSourceFactory.build(myBuilder);

          expect(myBuilder.logger).toHaveBeenCalledTimes(1);
          expect(myBuilder.defineRelation).toHaveBeenCalledTimes(0);
        });
      });
    });
  });
});
