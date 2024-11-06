import { Command } from 'commander';

import makeBootstrapCommand from './commands/bootstrap';
import makeLoginCommand from './commands/login';
import makeLogsCommand from './commands/logs';
import makePackageCommand from './commands/package';
import makePublishCommand from './commands/publish';
import makeStartCommand from './commands/start';
import makeUpdateTypingsCommand from './commands/update-typings';
import makeVersionCommand from './commands/version';
import { MakeCommands } from './types';

export default function makeCommands(context: MakeCommands): Command {
  // it's very important to use a new instance of Command each time for testing purposes
  const program = new Command();

  program.configureOutput({
    writeOut: context.logger.log,
    writeErr: message => {
      if (message.startsWith('error:')) {
        const messageWithoutError = message.slice(6);
        context.logger.error(messageWithoutError);
      } else {
        context.logger.error(message);
      }
    },
  });

  makeBootstrapCommand(program, context);
  makeLoginCommand(program, context);
  makeLogsCommand(program, context);
  makePackageCommand(program, context);
  makePublishCommand(program, context);
  makeUpdateTypingsCommand(program, context);
  makeVersionCommand(program, context);
  makeStartCommand(program, context);

  return program;
}
