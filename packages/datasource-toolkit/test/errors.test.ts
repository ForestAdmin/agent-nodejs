import { IntrospectionFormatError } from '../src/errors';

describe('errors', () => {
  describe('IntrospectionFormatError', () => {
    describe('message', () => {
      it.each([['@forestadmin/datasource-mongo'], ['@forestadmin/datasource-sql']])(
        'for package %s it should display the correct message',
        source => {
          const error = new IntrospectionFormatError(
            source as '@forestadmin/datasource-sql' | '@forestadmin/datasource-mongo',
          );
          expect(error.message).toEqual(
            `This version of introspection is newer than this package version. Please update ${source}`,
          );
        },
      );
    });
  });
});
