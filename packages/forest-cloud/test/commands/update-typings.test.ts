/* eslint-disable max-len */
import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';
import DistPathManager from '../../src/services/dist-path-manager';

describe('update-typings command', () => {
  describe('with a datasource sql introspection', () => {
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
        cmd.spinner.start('Updating typings'),
        cmd.spinner.succeed('Your typings have been updated'),
        cmd.spinner.stop(),
      ]);

      await expect(fs.access(setup.bootstrapPathManager.typings)).resolves.not.toThrow();

      const typings = await fs.readFile(setup.bootstrapPathManager.typings, 'utf-8');
      expect(typings).toContain("'HelloWorld': string");
    });
  });

  describe('with a datasource mongo introspection', () => {
    it('should update the typings from the introspection provided by the forest server', async () => {
      const getIntrospection = jest.fn().mockResolvedValue({
        models: [
          {
            name: 'comments',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                date: { type: 'Date', nullable: false },
                name: { type: 'string', nullable: false },
                text: { type: 'string', nullable: false },
                email: { type: 'string', nullable: false },
                movie_id: { type: 'ObjectId', nullable: false },
              },
              nullable: false,
            },
          },
          {
            name: 'movies',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                title: { type: 'string', nullable: false },
                tomatoes: {
                  type: 'object',
                  object: {
                    critic: {
                      type: 'object',
                      object: {
                        meter: { type: 'number', nullable: false },
                        rating: { type: 'number', nullable: false },
                        numReviews: { type: 'number', nullable: false },
                      },
                      nullable: false,
                    },
                  },
                  nullable: false,
                },
                lastupdated: { type: 'string', nullable: false },
              },
              nullable: false,
            },
          },
          {
            name: 'forestCollection',
            analysis: {
              type: 'object',
              object: {
                id: { type: 'ObjectId', nullable: false },
                jwt: { type: 'string', nullable: false },
                user_id: { type: 'string', nullable: false },
              },
              nullable: false,
            },
          },
        ],
        source: '@forestadmin/datasource-mongo',
        version: 1,
      });
      const setup = setupCommandArguments({ getIntrospection });
      setup.distPathManager = new DistPathManager(path.join(__dirname, '/__data__'));
      await fs.rm(setup.bootstrapPathManager.typings, {
        force: true,
        recursive: true,
      });

      const cmd = new CommandTester(setup, ['update-typings']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Updating typings'),
        cmd.spinner.succeed('Your typings have been updated'),
        cmd.spinner.stop(),
      ]);

      await expect(fs.access(setup.bootstrapPathManager.typings)).resolves.not.toThrow();

      const typings = await fs.readFile(setup.bootstrapPathManager.typings, 'utf-8');
      expect(typings).toContain("'HelloWorld': string");
      expect(typings).toContain("'tomatoes@@@critic@@@meter': number;");
      expect(typings).toContain(
        "export type CommentsAggregation = TAggregation<Schema, 'comments'>;",
      );
    });
  });
});
