import { Args, Command } from '@oclif/core';

import generateOrUpdateTypings from '../services/typings-updater.js';

export default class UpdateTypings extends Command {
  static override args = {
    name: Args.string({
      default: 'typings.d.ts',
      description: 'Destination file name',
      required: false,
    }),
  };

  static override description = 'Update the typings file if the schema has changed';

  static override examples = [`$ cloud-customizer update-typings 'typings.d.ts'`];

  async run(): Promise<void> {
    const { args } = await this.parse(UpdateTypings);
    generateOrUpdateTypings(args.name);
  }
}
