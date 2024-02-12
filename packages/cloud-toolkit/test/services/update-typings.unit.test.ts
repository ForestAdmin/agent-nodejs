import * as agent from '@forestadmin/agent';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import * as datasourceSQL from '@forestadmin/datasource-sql';
import { Table } from '@forestadmin/datasource-sql';
import fs from 'fs';
import path from 'path';

import { BusinessError, CustomizationError } from '../../src/errors';
import { updateTypings, updateTypingsWithCustomizations } from '../../src/services/update-typings';

jest.mock('path');

describe('update-typings', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  function setup() {
    const introspection = Symbol('introspection') as unknown as Table[];
    const datasource = Symbol('datasource') as unknown as () => Promise<SequelizeDataSource>;
    const agentMock = {
      addDataSource: jest.fn(),
      addChart: jest.fn(),
      updateTypesOnFileSystem: jest.fn(),
    } as unknown as agent.Agent;
    const createAgentSpy = jest.spyOn(agent, 'createAgent').mockReturnValue(agentMock);
    const createSqlDataSourceSpy = jest
      .spyOn(datasourceSQL, 'createSqlDataSource')
      .mockReturnValue(datasource);

    return { introspection, createAgentSpy, createSqlDataSourceSpy, agentMock, datasource };
  }

  describe('updateTypings', () => {
    it('should create an agent and generate typings from introspection', () => {
      const { introspection, createAgentSpy, createSqlDataSourceSpy, agentMock, datasource } =
        setup();
      updateTypings('./typings.d.ts', introspection);
      expect(createAgentSpy).toHaveBeenCalledWith({
        authSecret: 'a'.repeat(64),
        envSecret: 'a'.repeat(64),
        loggerLevel: 'Error',
        isProduction: false,
      });
      expect(createSqlDataSourceSpy).toHaveBeenCalledWith('sqlite::memory:', { introspection });
      expect(agentMock.addDataSource).toHaveBeenCalledWith(datasource);
      expect(agentMock.updateTypesOnFileSystem).toHaveBeenCalledWith('./typings.d.ts', 3);
    });
  });

  describe('updateTypingsWithCustomizations', () => {
    describe('if no customization file is found', () => {
      it('should throw a specific business error', async () => {
        const { introspection } = setup();
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        path.resolve = jest.fn().mockReturnValue('/path/to/index.js');

        await expect(
          updateTypingsWithCustomizations('./typings.d.ts', introspection),
        ).rejects.toEqual(
          new BusinessError(
            `No built customization found at /path/to/index.js.\n` +
              'Please run `yarn build` to build your customizations.',
          ),
        );
      });
    });
    describe('if a customization file is found', () => {
      describe('if the customization function throws an error', () => {
        it('should be rethrown as CustomizationError', async () => {
          const { introspection, agentMock } = setup();
          jest.spyOn(fs, 'existsSync').mockReturnValue(true);
          jest
            .mocked(path.resolve)
            .mockReturnValue('../../test/services/__data__/customization/error');

          await expect(
            updateTypingsWithCustomizations('./typings.d.ts', introspection),
          ).rejects.toEqual(
            new CustomizationError('Issue with customizations: Error\nSome error occured'),
          );
          expect(agentMock.updateTypesOnFileSystem).not.toHaveBeenCalled();
        });
      });
      describe('if the customization file does not export a function', () => {
        it('should throw with a specific customization error', async () => {
          const { introspection, agentMock } = setup();
          jest.spyOn(fs, 'existsSync').mockReturnValue(true);
          jest
            .mocked(path.resolve)
            .mockReturnValue('../../test/services/__data__/customization/not-a-function');
          await expect(
            updateTypingsWithCustomizations('./typings.d.ts', introspection),
          ).rejects.toEqual(new CustomizationError('Customization file must export a function'));
          expect(agentMock.updateTypesOnFileSystem).not.toHaveBeenCalled();
        });
      });
      it.each(['default', 'exports', 'package'])(
        'if the export startegy is %s',
        async directory => {
          const { introspection, agentMock } = setup();
          jest.spyOn(fs, 'existsSync').mockReturnValue(true);
          jest
            .mocked(path.resolve)
            .mockReturnValue(`../../test/services/__data__/customization/${directory}`);
          await updateTypingsWithCustomizations('./typings.d.ts', introspection);
          expect(agentMock.updateTypesOnFileSystem).toHaveBeenCalledWith('./typings.d.ts', 3);
        },
      );
    });
  });
});
