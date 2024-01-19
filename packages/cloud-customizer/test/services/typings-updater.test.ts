import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';

import * as agent from '@forestadmin/agent';
import * as datasourceSQL from '@forestadmin/datasource-sql';

import generateOrUpdateTypings from '../../src/services/typings-updater';

describe('generateOrUpdateTypings', () => {
  it('should create a standalone agent object to generate the typings', () => {
    const updateTypesOnFileSystemMock = jest.fn();
    const createStandaloneAgentMock = jest.spyOn(agent, 'createStandaloneAgent').mockReturnValue({
      addDataSource: jest.fn(),
      updateTypesOnFileSystem: updateTypesOnFileSystemMock,
    } as unknown as agent.Agent);
    const datasourceSQLMock = jest
      .spyOn(datasourceSQL, 'createSqlDataSource')
      .mockReturnValue(Symbol('datasource') as unknown as DataSourceFactory);

    generateOrUpdateTypings('toto.d.ts');
    expect(datasourceSQLMock).toHaveBeenCalledWith(
      `sqlite::memory:`,
      expect.objectContaining({ introspection: expect.any(Object) }),
    );
    expect(createStandaloneAgentMock).toHaveBeenCalled();
    expect(updateTypesOnFileSystemMock).toHaveBeenCalledWith('toto.d.ts', 5);
  });
});
