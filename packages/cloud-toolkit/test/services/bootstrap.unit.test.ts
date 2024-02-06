import AdmZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs';
import * as fsP from 'fs/promises';
import { homedir } from 'node:os';
import * as os from 'os';
import path from 'path';
import stream from 'stream';

import { BusinessError } from '../../src/errors';
import bootstrap from '../../src/services/bootstrap';
import HttpForestServer from '../../src/services/http-forest-server';
// import typingsUpdater from '../../src/services/update-typings';

jest.mock('adm-zip');
jest.mock('axios');
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('node:os');
jest.mock('os');
jest.mock('path');

jest.mock('../../src/services/update-typings', () => {
  return {
    default: jest.fn(() => {}),
    typingsUpdater: jest.fn(() => {}),
  };
});

describe('bootstrap', () => {
  const setup = () => {};

  describe('If the target directory exists', () => {
    it('should throw a business error', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const httpForestServer = new HttpForestServer('', '', '');
      await expect(bootstrap('abc', httpForestServer)).rejects.toEqual(
        new BusinessError('You have already a cloud-customizer folder.'),
      );
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });
  describe('If the target directory doesnt exists', () => {
    it('should throw a business error', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'createWriteStream').mockReturnValue({
        on: (eventName: string, callback: () => unknown) => {
          callback();
        },
      } as unknown as fs.WriteStream);
      const axiosMock = axios as unknown as jest.Mock;
      const response = { data: new stream.PassThrough() };
      axiosMock.mockResolvedValue(response);
      response.data.pipe = jest.fn().mockImplementation(() => ({}));
      const httpForestServer = new HttpForestServer('', '', '');
      (AdmZip as unknown as jest.Mock).mockReturnValue({ extractAllTo: () => {} });
      jest.spyOn(os, 'tmpdir').mockReturnValue('/tmp');
      jest.spyOn(fsP, 'rename').mockResolvedValue();
      jest.spyOn(fsP, 'rm').mockResolvedValue();
      jest.spyOn(fsP, 'rm').mockResolvedValue();
      path.join = jest.fn();

      await bootstrap('abc', httpForestServer);

      expect(axiosMock).toHaveBeenCalled();
      expect(axiosMock).toHaveBeenLastCalledWith({
        url: 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip',
        method: 'get',
        responseType: 'stream',
      });
      expect(fs.createWriteStream).toHaveBeenCalled();
    });
  });
});
