import type { Spinner } from '../types';

import { BusinessError } from '../errors';

export default function actionRunner(spinner: Spinner, fn: (...args) => Promise<any>) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      const error: Error = e;

      if (error instanceof BusinessError) {
        spinner.fail(error.message);
        // we must exit the process with a non-zero code to indicate an error
        // when chaining commands, the process will continue if we don't exit
        process.exitCode = 1;
      } else {
        spinner.fail(
          'An unexpected error occurred.\nPlease reach out for help in our Developers community (https://community.forestadmin.com/)',
        );
        throw error;
      }
    } finally {
      spinner.stop();
    }
  };
}
