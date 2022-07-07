import { Sequelize } from 'sequelize';

import ModelFactory from '../../src/utils/model-factory';

describe('ModelFactory', () => {
  const setup = () => {
    const sequelize = { define: jest.fn() } as any as Sequelize;

    return { sequelize };
  };

  describe('build', () => {
    describe('when the model is not valid', () => {
      it('should add the model to the excluded list', () => {
        const { sequelize } = setup();
        (sequelize.define as jest.Mock).mockImplementation(() => {
          throw new Error('Model is not valid');
        });
        const fieldDescription = ['aFieldDescription'];
        const excludedModels = [];

        ModelFactory.build('tableC', [fieldDescription], sequelize, excludedModels);

        expect(excludedModels).toEqual(['tableC']);
      });
    });
  });
});
