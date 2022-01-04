import superagent from 'superagent';
import ForestHttpApi from '../../src/services/forest-http-api';
import superagentMock from '../__mocks__/superagent';
import factories from '../__factories__';

describe('ForestHttpApi', () => {
  describe('initialize', () => {
    describe('when forestServerUrl or envSecret are null', () => {
      it('should throw an error', () => {
        expect(() => new ForestHttpApi(null, null)).toThrowError(
          'forestServerUrl: null and envSecret null must be present.',
        );
      });
    });
  });

  describe('getIpWhitelist', () => {
    test('should fetch the correct end point with the env secret', async () => {
      superagentMock.set = jest.fn().mockResolvedValue({
        body: {
          attributes: {
            use_ip_whitelist: true,
            rules: [],
          },
        },
      });

      const service = new ForestHttpApi('api.url', 'myEnvSecret');
      await service.getIpWhitelist();

      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
      expect(superagent.get).toHaveBeenCalledWith('api.url/liana/v1/ip-whitelist-rules');
    });

    describe('when the call succeeds', () => {
      test('should return the ip ranges and the isFeatureEnabled attributes', async () => {
        const ipRanges = factories.ipRange.buildList(1);
        const isFeatureEnabled = true;

        superagentMock.set = jest.fn().mockResolvedValue({
          body: {
            attributes: {
              use_ip_whitelist: isFeatureEnabled,
              rules: ipRanges,
            },
          },
        });

        const service = new ForestHttpApi('api.url', 'myEnvSecret');
        const result = await service.getIpWhitelist();

        expect(result).toStrictEqual({ isFeatureEnabled, ipRanges });
      });
    });

    describe('when the call fails', () => {
      test('should throw an error', async () => {
        superagentMock.set = jest.fn().mockResolvedValue(new Error());

        const service = new ForestHttpApi('api.url', 'myEnvSecret');
        await expect(service.getIpWhitelist()).rejects.toThrow(
          'An error occurred while retrieving your IP whitelist.',
        );
      });
    });
  });
});
