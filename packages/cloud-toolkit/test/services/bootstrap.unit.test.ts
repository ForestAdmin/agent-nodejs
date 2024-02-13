import { Table } from '@forestadmin/datasource-sql';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as fsP from 'fs/promises';
import * as os from 'os';

import { BusinessError } from '../../src/errors';
import bootstrap from '../../src/services/bootstrap';
import HttpServer from '../../src/services/http-server';
import { updateTypings } from '../../src/services/update-typings';

jest.mock('adm-zip');
jest.mock('fs');
jest.mock('os');
jest.mock('fs/promises');

jest.spyOn(os, 'tmpdir').mockReturnValue('/tmp');
jest.mock('../../src/services/update-typings', () => {
  return {
    default: jest.fn(() => {}),
    updateTypings: jest.fn(),
  };
});

describe('bootstrap', () => {
  describe('If the target directory exists', () => {
    it('should throw a business error', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const httpForestServer = new HttpServer('', '', '');
      await expect(bootstrap('abc', httpForestServer)).rejects.toEqual(
        new BusinessError('You have already a cloud-customizer folder.'),
      );
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });

  describe('If the target directory does not exists', () => {
    describe('If some process fails', () => {
      it('should throw a BusinessError', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        jest.spyOn(os, 'homedir').mockReturnValue('/my/home/directory');
        const httpForestServer = new HttpServer('', '', '');
        HttpServer.downloadCloudCustomizerTemplate = jest
          .fn()
          .mockRejectedValue(new Error('Failed'));

        await expect(bootstrap('abc', httpForestServer)).rejects.toEqual(
          new BusinessError('Bootstrap failed: Failed.'),
        );
      });
    });
    describe('If no dependency call fails', () => {
      it('should run the bootstrap completely', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);
        jest.spyOn(os, 'homedir').mockReturnValue('/my/home/directory');
        const writeFileSpy = jest.spyOn(fsP, 'writeFile');
        jest.spyOn(fsP, 'readFile').mockImplementation(async () => {
          return `
          env: <FOREST_ENV_SECRET_TO_REPLACE>
          path: <TOKEN_PATH_TO_REPLACE>
          collection: <COLLECTION_NAME_TO_REPLACE>
          dep: <DEPENDENCY_TO_REPLACE>
          `;
        });
        jest.spyOn(fs, 'createWriteStream').mockReturnValue({
          on: (eventName: string, callback: () => unknown) => {
            callback();
          },
        } as unknown as fs.WriteStream);
        const httpForestServer = new HttpServer('', '', '');
        const introspection: Table[] = [
          {
            name: 'towns',
            schema: 'public',
            unique: [['code', 'department'], ['id']],
            columns: [
              {
                name: 'id',
                type: {
                  type: 'scalar',
                  subType: 'NUMBER',
                },
                allowNull: false,
                primaryKey: true,
                constraints: [],
                defaultValue: null,
                autoIncrement: true,
                isLiteralDefaultValue: true,
              },
              {
                name: 'name',
                type: {
                  type: 'scalar',
                  subType: 'STRING',
                },
                allowNull: false,
                primaryKey: false,
                constraints: [],
                defaultValue: null,
                autoIncrement: false,
                isLiteralDefaultValue: false,
              },
            ],
          },
        ];
        jest.spyOn(httpForestServer, 'getIntrospection').mockResolvedValue(introspection);
        HttpServer.downloadCloudCustomizerTemplate = jest.fn();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        jest.mocked(AdmZip).mockReturnValue({ extractAllTo: () => {} });
        const renameSpy = jest.spyOn(fsP, 'rename').mockResolvedValue();
        const rmSpy = jest.spyOn(fsP, 'rm').mockResolvedValue();

        await bootstrap('abc', httpForestServer);

        expect(HttpServer.downloadCloudCustomizerTemplate).toHaveBeenCalled();
        expect(HttpServer.downloadCloudCustomizerTemplate).toHaveBeenCalledWith(
          '/tmp/cloud-customizer.zip',
        );
        expect(renameSpy).toHaveBeenCalledWith('/tmp/cloud-customizer-main', 'cloud-customizer');
        expect(rmSpy).toHaveBeenCalledWith('/tmp/cloud-customizer.zip', { force: true });

        expect(writeFileSpy).toHaveBeenCalledTimes(2);
        const firstCallArgs = writeFileSpy.mock.calls[0];
        expect(firstCallArgs[0]).toBe('cloud-customizer/.env');
        expect(firstCallArgs[1].toString().replace(/\s/g, '')).toBe(
          `
              env: abc
              path: /my/home/directory
              collection: <COLLECTION_NAME_TO_REPLACE>
              dep: <DEPENDENCY_TO_REPLACE>
              `.replace(/\s/g, ''),
        );
        const secondCallArgs = writeFileSpy.mock.calls[1];
        expect(secondCallArgs[0]).toBe('cloud-customizer/src/index.ts');
        expect(secondCallArgs[1].toString().replace(/\s/g, '')).toBe(
          `
              env: <FOREST_ENV_SECRET_TO_REPLACE>
              path: <TOKEN_PATH_TO_REPLACE>
              collection: towns
              dep: id
              `.replace(/\s/g, ''),
        );

        expect(updateTypings).toHaveBeenCalled();
        expect(updateTypings).toHaveBeenCalledWith('cloud-customizer/typings.d.ts', introspection);
      });
    });
  });
});
