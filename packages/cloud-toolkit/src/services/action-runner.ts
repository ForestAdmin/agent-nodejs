import ora from 'ora';

import { BusinessError, CustomizationError } from '../errors';

export default function actionRunner(fn: (...args) => Promise<any>) {
  return async (...args) => {
    const spinner = ora().start();

    try {
      await fn(spinner, ...args);
    } catch (e) {
      const error: Error = e;

      if (error instanceof BusinessError || error instanceof CustomizationError) {
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
