import AdmZip from 'adm-zip';
import axios from 'axios';
import * as fs from 'fs';
import * as fsP from 'fs/promises';
import { homedir } from 'node:os';
import * as os from 'os';
import path from 'path';

import { BusinessError } from '../../src/errors';
import bootstrap from '../../src/services/bootstrap';
import HttpForestServer from '../../src/services/http-forest-server';

jest.mock('adm-zip');
jest.mock('axios');
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('node:os');
jest.mock('os');
jest.mock('path');

describe('bootstrap', () => {
  const setup = () => {};

  describe('If the target directory exists', () => {
    it('should throw a business error', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const b = new HttpForestServer('', '', '');
      await expect(bootstrap('abc', b)).rejects.toEqual(
        new BusinessError('You have already a cloud-customizer folder.'),
      );
    });
  });
});
