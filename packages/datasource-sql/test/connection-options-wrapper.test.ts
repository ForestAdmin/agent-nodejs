import ConnectionOptionsWrapper from '../src/connection-options-wrapper';

describe('ConnectionOptionsWrapper', () => {
  describe('portFromUriOrOptions', () => {
    describe('when the port is not defined', () => {
      describe('when the dialect is postgres', () => {
        it('should return the default port', () => {
          const wrapper = new ConnectionOptionsWrapper({
            dialect: 'postgres',
            port: undefined,
          });

          expect(wrapper.portFromUriOrOptions).toEqual(5432);
        });
      });

      describe('when the dialect is mssql', () => {
        it('should return the default port', () => {
          const wrapper = new ConnectionOptionsWrapper({
            dialect: 'mssql',
            port: undefined,
          });

          expect(wrapper.portFromUriOrOptions).toEqual(1433);
        });
      });

      describe('when the dialect is mysql', () => {
        it('should return the default port', () => {
          const wrapper = new ConnectionOptionsWrapper({
            dialect: 'mysql',
            port: undefined,
          });

          expect(wrapper.portFromUriOrOptions).toEqual(3306);
        });
      });

      describe('when the dialect is mariadb', () => {
        it('should return the default port', () => {
          const wrapper = new ConnectionOptionsWrapper({
            dialect: 'mariadb',
            port: undefined,
          });

          expect(wrapper.portFromUriOrOptions).toEqual(3306);
        });
      });

      describe('when the dialect has not default port', () => {
        it('should return undefined', () => {
          const wrapper = new ConnectionOptionsWrapper({
            dialect: 'db2',
            port: undefined,
          });

          expect(wrapper.portFromUriOrOptions).toBeUndefined();
        });
      });
    });
  });

  describe('uriIfValidOrNull', () => {
    describe('when the uri is not valid', () => {
      it('should return null', () => {
        const wrapper = new ConnectionOptionsWrapper({ uri: 'bad' });

        expect(wrapper.uriIfValidOrNull).toBeNull();
      });
    });
  });
});
