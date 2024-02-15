import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';

describe('update-typings command', () => {
  beforeEach(async () => {
    const setup = setupCommandArguments();
    await fs.rm(setup.distPathManager.distCodeCustomizations, { force: true, recursive: true });
    await fs.rm(setup.bootstrapPathManager.typingsAfterBootstrapped, {
      force: true,
      recursive: true,
    });
  });

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

    // create the dist folder with the customizations
    const distPath = setup.distPathManager.distCodeCustomizations;
    await fs.mkdir(distPath, { recursive: true });
    await fs.writeFile(
      path.join(distPath, 'index.ts'),
      `export default function customizeAgent(agent) {
              agent.customizeCollection('forestCollection', collection => {
                collection.addField('HelloWorld', {
                  columnType: 'String',
                  defaultValue: 'Hello World',
                  dependencies: ['id'],
                  getValues(records) {
                    return records.map(() => 'Hello World');
                  },
                });
              });
            }`,
    );

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

    await expect(
      fs.access(setup.bootstrapPathManager.typingsAfterBootstrapped),
    ).resolves.not.toThrow();

    const typings = await fs.readFile(setup.bootstrapPathManager.typingsAfterBootstrapped, 'utf-8');
    expect(typings).toContain("'HelloWorld': string");
  });
});