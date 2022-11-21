import ForestHttpApi from '../../src/permissions/forest-http-api';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server', () => ({
  query: jest.fn(),
}));

describe('ForestHttpApi', () => {
  const options = factories.forestAdminClientOptions.build();

  test('getEnvironmentPermissions should call the right endpoint', async () => {
    await ForestHttpApi.getEnvironmentPermissions(options);

    expect(ServerUtils.query).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v4/permissions/environment',
    );
  });

  test('getUsers should call the right endpoint', async () => {
    await ForestHttpApi.getUsers(options);

    expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/v4/permissions/users');
  });

  test('getRenderingPermissions should call the right endpoint', async () => {
    await ForestHttpApi.getRenderingPermissions(42, options);

    expect(ServerUtils.query).toHaveBeenCalledWith(
      options,
      'get',
      '/liana/v4/permissions/renderings/42',
    );
  });
});
