/* eslint-disable max-classes-per-file */
import { BusinessError } from '@forestadmin/datasource-toolkit';

export class SshConnectError extends BusinessError {
  constructor(message: string, debugSshUri: string) {
    super(
      `Your ssh connection has encountered an error. ` +
        `Unable to connect to the given ssh uri: ${debugSshUri}. ${message}`,
    );
  }
}

export class ConnectionError extends BusinessError {
  constructor(uri: string, message: string) {
    super(`Unable to connect to the given uri: ${uri}. ${message}`);
  }
}
