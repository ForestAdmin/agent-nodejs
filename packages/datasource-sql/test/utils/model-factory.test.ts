import { Model } from 'sequelize/types/model';
import { ModelStatic, Sequelize } from 'sequelize';

import { AbstractDataType } from 'sequelize/types/data-types';
import { FieldDescription } from '../../src/utils/types';
import ModelFactory from '../../src/utils/model-factory';

describe('ModelFactory', () => {
  const setup = () => {
    const model = {
      belongsTo: jest.fn(),
    } as any as ModelStatic<Model>;
    const referenceModel = {
      hasOne: jest.fn(),
      hasMany: jest.fn(),
    } as any as ModelStatic<Model>;
    const sequelize = { define: jest.fn() } as any as Sequelize;

    return { model, referenceModel, sequelize };
  };

  describe('build', () => {
    describe('when the model is not valid', () => {
      it('should add the model to the excluded list', () => {
        const { sequelize } = setup();
        (sequelize.define as jest.Mock).mockImplementation(() => {
          throw new Error('Model is not valid');
        });
        const fieldDescription = ['aFieldDescription'];
        const excludedTables = [];

        ModelFactory.build('tableC', [fieldDescription], sequelize, excludedTables);

        expect(excludedTables).toEqual(['tableC']);
      });
    });
  });
});
