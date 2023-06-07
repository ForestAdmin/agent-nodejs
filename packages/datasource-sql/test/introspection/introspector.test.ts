import { Sequelize } from 'sequelize';

import { Table } from '../../src';
import Introspector from '../../src/introspection/introspector';

describe('Introspector', () => {
  describe('when the introspection is stringified and after parsed', () => {
    describe('when the default value is a literal', () => {
      it('should return a literal after to be parsed', async () => {
        const column = {
          // a literal default value
          defaultValue: { val: 'gen_random_uuid()' },
          type: { type: 'scalar', subType: 'UUID' },
          autoIncrement: false,
          isLiteralDefaultValue: true,
          name: 'id',
          allowNull: false,
          primaryKey: false,
          constraints: [],
        };
        const introspection = [{ columns: [column], name: 'AModel', unique: [] }] as Table[];

        const getUuidDefaultValue = introspectionData =>
          introspectionData
            .find(table => table.name === 'AModel')
            .columns.find(c => c.name === 'id').defaultValue;

        const parsedIntrospection = Introspector.parse(Introspector.stringify(introspection));
        const literalExpectedValue = Sequelize.literal(
          (getUuidDefaultValue(introspection) as any).val,
        );
        expect(literalExpectedValue).toStrictEqual(getUuidDefaultValue(parsedIntrospection));
      });
    });
  });
});
