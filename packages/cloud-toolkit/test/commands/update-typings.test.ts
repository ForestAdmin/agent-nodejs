import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';
import DistPathManager from '../../src/services/dist-path-manager';

describe('update-typings command', () => {
  it('should update the typings from the introspection provided by the forest server', async () => {
    const getIntrospection = jest.fn().mockResolvedValue([
      {
        name: 'forestCollection',
        schema: 'public',
        columns: [
          {
            type: { type: 'scalar', subType: 'NUMBER' },
            autoIncrement: true,
            defaultValue: null,
            isLiteralDefaultValue: true,
            name: 'id',
            allowNull: false,
            primaryKey: true,
            constraints: [],
          },
        ],
        unique: [['id'], ['title']],
      },
    ]);
    const setup = setupCommandArguments({ getIntrospection });
    setup.distPathManager = new DistPathManager(path.join(__dirname, '/__data__'));
    await fs.rm(setup.bootstrapPathManager.typings, {
      force: true,
      recursive: true,
    });

    const cmd = new CommandTester(setup, ['update-typings']);
    await cmd.run();

    expect(cmd.outputs).toEqual([
      cmd.start('Updating typings'),
      cmd.succeed('Your typings have been updated'),
    ]);
    // TODO: agent does not have an await ! It's a bug but fixed on main.
    // remove this sleep when merging on main
    await new Promise(resolve => {
      setTimeout(resolve, 500);
    });

    await expect(fs.access(setup.bootstrapPathManager.typings)).resolves.not.toThrow();

    const typings = await fs.readFile(setup.bootstrapPathManager.typings, 'utf-8');
    expect(typings).toContain("'HelloWorld': string");
  });
});
