import ora from 'ora';

import { BusinessError } from '../errors';

export default function actionRunner(fn: (...args) => Promise<any>) {
  return async (...args) => {
    const spinner = ora().start();

    try {
      await fn(spinner, ...args);
    } catch (e) {
      const error: Error = e;

      if (error instanceof BusinessError) {
        spinner.fail(error.message);
      } else {
        throw error;
      }
    } finally {
      spinner.stop();
    }
  };
}
