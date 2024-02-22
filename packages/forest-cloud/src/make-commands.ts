import { Command } from 'commander';

import makeBootstrapCommand from './commands/bootstrap';
import makeLoginCommand from './commands/login';
import makePackageCommand from './commands/package';
import makePublishCommand from './commands/publish';
import makeUpdateTypingsCommand from './commands/update-typings';
import makeVersionCommand from './commands/version';
import { MakeCommands } from './types';

export default function makeCommands(context: MakeCommands): Command {
  // it's very important to use a new instance of Command each time for testing purposes
  const program = new Command();

  makeBootstrapCommand(program, context);
  makePackageCommand(program, context);
  makePublishCommand(program, context);
  makeUpdateTypingsCommand(program, context);
  makeLoginCommand(program, context);
  makeVersionCommand(program, context);

  return program;
}
