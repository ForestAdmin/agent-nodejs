import ConnectionOptions from '../../src/connection/connection-options';

describe('ConnectionOptionsWrapper', () => {
  describe('port', () => {
    describe('when the port is not defined', () => {
      describe('when the dialect is postgres', () => {
        it('should return the default port', () => {
          const options = new ConnectionOptions({
            dialect: 'postgres',
            host: 'localhost',
            port: undefined,
          });

          expect(options.port).toEqual(5432);
        });
      });

      describe('when the dialect is mssql', () => {
        it('should return the default port', () => {
          const options = new ConnectionOptions({
            dialect: 'mssql',
            port: undefined,
          });

          expect(options.port).toEqual(1433);
        });
      });

      describe('when the dialect is mysql', () => {
        it('should return the default port', () => {
          const options = new ConnectionOptions({
            dialect: 'mysql',
            port: undefined,
          });

          expect(options.port).toEqual(3306);
        });
      });

      describe('when the dialect is mariadb', () => {
        it('should return the default port', () => {
          const options = new ConnectionOptions({
            dialect: 'mariadb',
            port: undefined,
          });

          expect(options.port).toEqual(3306);
        });
      });

      describe('when the dialect has not default port', () => {
        it('should throw', () => {
          const fn = () =>
            new ConnectionOptions({
              dialect: 'db2',
              port: undefined,
            });

          expect(fn).toThrow('Port is required');
        });
      });
    });
  });
});
