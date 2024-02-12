import ora from 'ora';

import { BusinessError } from '../errors';

export default function actionRunner(fn: (...args) => Promise<any>) {
  return async (...args) => {
    const spinner = ora();

    try {
      await fn(spinner, ...args);
    } catch (e) {
      const error: Error = e;

      if (error instanceof BusinessError) {
        spinner.fail(error.message);
        // we must exit the process with a non-zero code to indicate an error
        // it useful to avoid running the next command if the current one failed
        process.exit(1);
      } else {
        throw error;
      }
    } finally {
      spinner.stop();
    }
  };
}
