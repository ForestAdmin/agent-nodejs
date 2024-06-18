import DataSourceCustomizer from '../src/datasource-customizer';
import CompositeDatasource from '../src/decorators/composite-datasource';
import DecoratorsStack from '../src/decorators/decorators-stack';

jest.mock('../src/decorators/decorators-stack');
jest.mock('../src/decorators/composite-datasource');

describe('DatasourceCustomizer', () => {
  describe('constructor', () => {
    it('should pass the options to the decorators stack', () => {
      const options = { catchMissingSchemaElementErrors: true };

      // eslint-disable-next-line no-new
      new DataSourceCustomizer(options);

      expect(DecoratorsStack).toHaveBeenCalledWith(expect.any(CompositeDatasource), options);
    });
  });
});
